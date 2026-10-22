import type { PoolClient } from 'pg';
import type { DocVisibility } from '@miceplans/domain';

export type EventDocRow = { id: string; eventId: string; title: string; visibility: DocVisibility; version: number };

type RawRow = { id: string; event_id: string; title: string; visibility: DocVisibility; version: number };
const toRow = (r: RawRow): EventDocRow => ({ id: r.id, eventId: r.event_id, title: r.title, visibility: r.visibility, version: r.version });

/** 열람 범위 필터링은 RLS가 한다. 목록에는 현재 사용자가 볼 수 있는 문서만 나온다. */
export async function listDocs(client: PoolClient, eventId: string): Promise<EventDocRow[]> {
  const { rows } = await client.query<RawRow>('SELECT id, event_id, title, visibility, version FROM event_docs WHERE event_id = $1 ORDER BY title', [eventId]);
  return rows.map(toRow);
}

/** version이 다르면 충돌로 보고 null을 돌려준다. 권한이 없으면 RLS 때문에 0행이라 역시 null이다. */
export async function setDocVisibility(client: PoolClient, docId: string, visibility: DocVisibility, expectedVersion: number, actorId: string): Promise<EventDocRow | null> {
  const { rows } = await client.query<RawRow>(
    `UPDATE event_docs SET visibility = $2, version = version + 1 WHERE id = $1 AND version = $3 RETURNING id, event_id, title, visibility, version`,
    [docId, visibility, expectedVersion],
  );
  const row = rows[0];
  if (!row) return null;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'doc.visibility.change', $3)`, [row.event_id, actorId, JSON.stringify({ docId, visibility })]);
  return toRow(row);
}
