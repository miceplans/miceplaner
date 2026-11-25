import type { PoolClient } from 'pg';
import type { ProductPart } from '@miceplans/domain';
import { isoTs } from './sql';

// 행사 상세의 제작물(디자인 요청) 표와 캘린더 일정 블록. 웹이 만든 uuid로 식별하고 행 단위로 통째로 저장한다(마지막 저장 우선).
// 가시성(내부 직원)과 쓰기 권한(행사 멤버)은 RLS가 강제한다.

export type ProductStatus = 'draft' | 'pending' | 'success' | 'reject';

export type EventProductRow = {
  id: string; eventId: string; name: string; part: ProductPart; dueOn: string | null; size: string; qty: string; material: string;
  vendor: string; contact: string; note: string; negotiating: boolean; status: ProductStatus; updatedAt: string;
};
export type EventProductInput = Omit<EventProductRow, 'eventId' | 'updatedAt'>;

const PRODUCT_COLUMNS = `id, event_id AS "eventId", name, part, to_char(due_on, 'YYYY-MM-DD') AS "dueOn", size, qty, material, vendor, contact, note,
  negotiating, status, ${isoTs('updated_at', 'updatedAt')}`;

export async function listEventProducts(client: PoolClient, eventId: string): Promise<EventProductRow[]> {
  const { rows } = await client.query<EventProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM event_products WHERE event_id = $1 AND deleted_at IS NULL ORDER BY created_at, id`, [eventId]);
  return rows;
}

/**
 * 없으면 만들고 있으면 덮어쓴다. 같은 id가 다른 행사에 있거나 삭제됐으면 undefined(충돌)다.
 * 권한이 없으면 RLS가 거부한다.
 */
export async function saveEventProduct(client: PoolClient, actorId: string, eventId: string, p: EventProductInput): Promise<EventProductRow | undefined> {
  const { rows } = await client.query<EventProductRow>(
    `INSERT INTO event_products AS t (id, event_id, name, part, due_on, size, qty, material, vendor, contact, note, negotiating, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, part = EXCLUDED.part, due_on = EXCLUDED.due_on, size = EXCLUDED.size, qty = EXCLUDED.qty,
       material = EXCLUDED.material, vendor = EXCLUDED.vendor, contact = EXCLUDED.contact, note = EXCLUDED.note, negotiating = EXCLUDED.negotiating,
       status = EXCLUDED.status, updated_by = EXCLUDED.updated_by
     WHERE t.event_id = EXCLUDED.event_id AND t.deleted_at IS NULL
     RETURNING ${PRODUCT_COLUMNS}`,
    [p.id, eventId, p.name, p.part, p.dueOn, p.size, p.qty, p.material, p.vendor, p.contact, p.note, p.negotiating, p.status, actorId],
  );
  return rows[0];
}

export async function deleteEventProduct(client: PoolClient, id: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>('SELECT soft_delete_event_product($1) AS ok', [id]);
  return rows[0]!.ok;
}

export async function getEventProductEventId(client: PoolClient, id: string): Promise<string | undefined> {
  const { rows } = await client.query<{ eventId: string }>(`SELECT event_id AS "eventId" FROM event_products WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return rows[0]?.eventId;
}

export type EventCalendarBlockRow = { id: string; eventId: string; title: string; date: string; startMinute: number; endMinute: number; updatedAt: string };
export type EventCalendarBlockInput = Omit<EventCalendarBlockRow, 'eventId' | 'updatedAt'>;

const BLOCK_COLUMNS = `id, event_id AS "eventId", title, to_char(block_date, 'YYYY-MM-DD') AS "date", start_minute AS "startMinute", end_minute AS "endMinute",
  ${isoTs('updated_at', 'updatedAt')}`;

export async function listEventCalendarBlocks(client: PoolClient, eventId: string): Promise<EventCalendarBlockRow[]> {
  const { rows } = await client.query<EventCalendarBlockRow>(`SELECT ${BLOCK_COLUMNS} FROM event_calendar_blocks WHERE event_id = $1 AND deleted_at IS NULL ORDER BY block_date, start_minute, id`, [eventId]);
  return rows;
}

export async function saveEventCalendarBlock(client: PoolClient, actorId: string, eventId: string, b: EventCalendarBlockInput): Promise<EventCalendarBlockRow | undefined> {
  const { rows } = await client.query<EventCalendarBlockRow>(
    `INSERT INTO event_calendar_blocks AS t (id, event_id, title, block_date, start_minute, end_minute, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, block_date = EXCLUDED.block_date, start_minute = EXCLUDED.start_minute,
       end_minute = EXCLUDED.end_minute, updated_by = EXCLUDED.updated_by
     WHERE t.event_id = EXCLUDED.event_id AND t.deleted_at IS NULL
     RETURNING ${BLOCK_COLUMNS}`,
    [b.id, eventId, b.title, b.date, b.startMinute, b.endMinute, actorId],
  );
  return rows[0];
}

export async function deleteEventCalendarBlock(client: PoolClient, id: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>('SELECT soft_delete_event_calendar_block($1) AS ok', [id]);
  return rows[0]!.ok;
}

export async function getEventCalendarBlockEventId(client: PoolClient, id: string): Promise<string | undefined> {
  const { rows } = await client.query<{ eventId: string }>(`SELECT event_id AS "eventId" FROM event_calendar_blocks WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return rows[0]?.eventId;
}
