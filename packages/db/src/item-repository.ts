import type { PoolClient } from 'pg';
import { isoTs } from './sql';
import type { ItemKind, ItemStatus, ProductPart } from '@miceplans/domain';

export type EventItemRow = {
  id: string; eventId: string; kind: ItemKind; parentId: string | null; title: string; description: string; part: ProductPart | null; status: ItemStatus;
  startsOn: string | null; dueOn: string | null; assigneeId: string | null; clientVisible: boolean; version: number; createdBy: string;
  completedAt: string | null; createdAt: string; updatedAt: string;
};

const COLUMNS = `id, event_id AS "eventId", kind, parent_id AS "parentId", title, description, part, status,
  to_char(starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(due_on, 'YYYY-MM-DD') AS "dueOn",
  assignee_id AS "assigneeId", client_visible AS "clientVisible", version, created_by AS "createdBy",
  ${isoTs('completed_at', 'completedAt')}, ${isoTs('created_at', 'createdAt')}, ${isoTs('updated_at', 'updatedAt')}`;

/** 가시성 필터링은 RLS가 한다. kind·상위·담당자·상태·파트 조건을 추가로 걸 수 있다. */
export async function listItems(client: PoolClient, eventId: string, filter: { kind?: ItemKind; parentId?: string; assigneeId?: string; status?: ItemStatus; part?: ProductPart } = {}): Promise<EventItemRow[]> {
  const cond = ['event_id = $1'];
  const vals: unknown[] = [eventId];
  const put = (column: string, value: unknown) => { vals.push(value); cond.push(`${column} = $${vals.length}`); };
  if (filter.kind) put('kind', filter.kind);
  if (filter.parentId !== undefined) put('parent_id', filter.parentId);
  if (filter.assigneeId !== undefined) put('assignee_id', filter.assigneeId);
  if (filter.status) put('status', filter.status);
  if (filter.part) put('part', filter.part);
  const { rows } = await client.query<EventItemRow>(`SELECT ${COLUMNS} FROM event_items WHERE ${cond.join(' AND ')} ORDER BY kind, starts_on NULLS LAST, created_at`, vals);
  return rows;
}

export type NewItem = { eventId: string; kind: ItemKind; parentId: string | null; title: string; description?: string; part?: ProductPart | null; status?: ItemStatus; startsOn?: string | null; dueOn?: string | null; assigneeId?: string | null };

export async function getItem(client: PoolClient, itemId: string): Promise<EventItemRow | undefined> {
  const { rows } = await client.query<EventItemRow>(`SELECT ${COLUMNS} FROM event_items WHERE id = $1`, [itemId]);
  return rows[0];
}

export type ItemPatch = { title?: string; description?: string; part?: ProductPart | null; status?: ItemStatus; startsOn?: string | null };

/** 제목·설명·파트·상태·시작일은 마지막 저장 우선이라 version을 받지 않는지만, 저장할 때마다 version은 올려 다른 낙관적 잠금과 충돌을 드러낸다. */
export async function updateItem(client: PoolClient, itemId: string, patch: ItemPatch): Promise<EventItemRow | undefined> {
  const sets: string[] = ['version = version + 1'];
  const vals: unknown[] = [];
  const put = (column: string, value: unknown) => { vals.push(value); sets.push(`${column} = $${vals.length}`); };
  if (patch.title !== undefined) put('title', patch.title);
  if (patch.description !== undefined) put('description', patch.description);
  if (patch.part !== undefined) put('part', patch.part);
  if (patch.status !== undefined) put('status', patch.status);
  if (patch.startsOn !== undefined) put('starts_on', patch.startsOn);
  vals.push(itemId);
  const { rows } = await client.query<EventItemRow>(`UPDATE event_items SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING ${COLUMNS}`, vals);
  return rows[0];
}

/** 담당자를 지정해 만들면 담당자에게 알림을 남긴다. 권한이 없으면 RLS가 거부한다. */
export async function createItem(client: PoolClient, actorId: string, item: NewItem): Promise<EventItemRow> {
  const { rows } = await client.query<EventItemRow>(
    `INSERT INTO event_items (event_id, kind, parent_id, title, description, part, status, starts_on, due_on, assignee_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, coalesce($7, '할 일'), $8, $9, $10, $11) RETURNING ${COLUMNS}`,
    [item.eventId, item.kind, item.parentId, item.title, item.description ?? '', item.part ?? null, item.status ?? null, item.startsOn ?? null, item.dueOn ?? null, item.assigneeId ?? null, actorId],
  );
  const row = rows[0]!;
  if (row.assigneeId) await notify(client, row, 'assigned');
  return row;
}

/** 담당자 변경은 version이 다르면 null(충돌)을 돌려준다. 변경은 감사 로그와 알림을 남긴다. */
export async function assignItem(client: PoolClient, actorId: string, itemId: string, assigneeId: string | null, expectedVersion: number): Promise<EventItemRow | null> {
  const { rows } = await client.query<EventItemRow>(`UPDATE event_items SET assignee_id = $2, version = version + 1 WHERE id = $1 AND version = $3 RETURNING ${COLUMNS}`, [itemId, assigneeId, expectedVersion]);
  const row = rows[0];
  if (!row) return null;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'item.assignee.change', $3)`, [row.eventId, actorId, JSON.stringify({ itemId, assigneeId })]);
  if (assigneeId) await notify(client, row, 'assigned');
  return row;
}

/** 마감일 변경도 version을 검사한다. 담당자에게 일정 변경 알림을 남긴다 (수신 범위는 미확정이라 담당자만). */
export async function rescheduleItem(client: PoolClient, itemId: string, startsOn: string | null, dueOn: string | null, expectedVersion: number): Promise<EventItemRow | null> {
  const { rows } = await client.query<EventItemRow>(`UPDATE event_items SET starts_on = $2, due_on = $3, version = version + 1 WHERE id = $1 AND version = $4 RETURNING ${COLUMNS}`, [itemId, startsOn, dueOn, expectedVersion]);
  const row = rows[0];
  if (!row) return null;
  if (row.assigneeId) await notify(client, row, 'schedule_changed');
  return row;
}

/** Client 공개 상태 변경. Program만 가능하며 감사 로그 대상이다. */
export async function setClientVisible(client: PoolClient, actorId: string, itemId: string, visible: boolean, expectedVersion: number): Promise<EventItemRow | null> {
  const { rows } = await client.query<EventItemRow>(`UPDATE event_items SET client_visible = $2, version = version + 1 WHERE id = $1 AND version = $3 RETURNING ${COLUMNS}`, [itemId, visible, expectedVersion]);
  const row = rows[0];
  if (!row) return null;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'item.client_visible.change', $3)`, [row.eventId, actorId, JSON.stringify({ itemId, visible })]);
  return row;
}

/** soft delete. 하위 항목은 DB 트리거가 함께 삭제한다. 권한이 없거나 대상이 없으면 false. */
export async function softDeleteItem(client: PoolClient, itemId: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>('SELECT soft_delete_event_item($1) AS ok', [itemId]);
  return rows[0]!.ok;
}

/** 행사 삭제는 PM만 한다 (아니면 예외). Program 이하 항목도 함께 삭제된다. 대상이 없으면 false. */
export async function softDeleteEvent(client: PoolClient, actorId: string, eventId: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>('SELECT soft_delete_event($1) AS ok', [eventId]);
  if (rows[0]!.ok) await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'event.delete', '{}')`, [eventId, actorId]);
  return rows[0]!.ok;
}

async function notify(client: PoolClient, row: EventItemRow, kind: 'assigned' | 'schedule_changed') {
  await client.query(`INSERT INTO notifications (recipient_id, event_id, item_id, kind, title) VALUES ($1, $2, $3, $4, $5)`, [row.assigneeId, row.eventId, row.id, kind, row.title]);
}

export type NotificationRow = { id: number; eventId: string | null; itemId: string | null; kind: string; title: string; createdAt: string; readAt: string | null };

export async function listNotifications(client: PoolClient, opts: { limit?: number; unread?: boolean } = {}): Promise<NotificationRow[]> {
  const cond: string[] = [];
  if (opts.unread) cond.push('read_at IS NULL');
  const { rows } = await client.query<NotificationRow>(
    `SELECT id::int, event_id AS "eventId", item_id AS "itemId", kind, title, ${isoTs('created_at', 'createdAt')}, ${isoTs('read_at', 'readAt')} FROM notifications ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT $1`,
    [opts.limit ?? 50],
  );
  return rows;
}

export async function markNotificationsRead(client: PoolClient, ids: number[]): Promise<number> {
  const { rowCount } = await client.query(`UPDATE notifications SET read_at = now() WHERE id = ANY($1::bigint[]) AND read_at IS NULL`, [ids]);
  return rowCount ?? 0;
}
