import type { PoolClient } from 'pg';
import { isoTs } from './sql';

export type ScheduleNoteRow = {
  key: string;
  eventId: string | null;
  content: Record<string, unknown>;
  version: number;
  updatedAt: string;
};

const COLUMNS = `note_key AS "key", event_id AS "eventId", content, version, ${isoTs('updated_at', 'updatedAt')}`;

/** 내부 직원만 조회한다 (RLS). 없으면 undefined다. */
export async function getScheduleNote(client: PoolClient, key: string): Promise<ScheduleNoteRow | undefined> {
  const { rows } = await client.query<ScheduleNoteRow>(`SELECT ${COLUMNS} FROM schedule_notes WHERE note_key = $1 AND deleted_at IS NULL`, [key]);
  return rows[0];
}

export type SaveScheduleNoteResult =
  | { kind: 'saved'; row: ScheduleNoteRow; assigneesChanged: { before: unknown; after: unknown } | null }
  | { kind: 'conflict'; currentVersion: number }
  | { kind: 'event_mismatch' };

/**
 * 바뀐 필드만 덮어쓴다(jsonb ||). 담당자를 바꿀 때만 baseVersion이 현재 version과 같아야 한다.
 * 담당자가 실제로 바뀌면 감사 로그를 남긴다. 권한은 RLS(행사 멤버 또는 행사 없는 날짜 메모)가 강제한다.
 */
export async function saveScheduleNote(
  client: PoolClient,
  input: { key: string; eventId: string | null; baseVersion: number; patch: Record<string, unknown>; actorId: string },
): Promise<SaveScheduleNoteResult> {
  // 처음 저장하는 키는 빈 행을 만든 뒤 잠근다. 동시에 만들어도 고유 인덱스가 하나만 남긴다.
  await client.query(
    `INSERT INTO schedule_notes (note_key, event_id, created_by, updated_by) VALUES ($1, $2, $3, $3)
     ON CONFLICT (note_key) WHERE deleted_at IS NULL DO NOTHING`,
    [input.key, input.eventId, input.actorId],
  );
  const { rows: locked } = await client.query<{ eventId: string | null; content: Record<string, unknown>; version: number }>(
    `SELECT event_id AS "eventId", content, version
     FROM schedule_notes WHERE note_key = $1 AND deleted_at IS NULL FOR UPDATE`,
    [input.key],
  );
  const current = locked[0];
  if (!current) throw Object.assign(new Error('일정 메모를 저장할 수 없다'), { code: '42501' });
  if (current.eventId !== input.eventId) return { kind: 'event_mismatch' };

  const touchesAssignees = 'assignees' in input.patch;
  if (touchesAssignees && input.baseVersion !== current.version) return { kind: 'conflict', currentVersion: current.version };

  const { rows } = await client.query<ScheduleNoteRow>(
    `UPDATE schedule_notes SET content = content || $2::jsonb, version = version + 1, updated_by = $3
     WHERE note_key = $1 AND deleted_at IS NULL RETURNING ${COLUMNS}`,
    [input.key, JSON.stringify(input.patch), input.actorId],
  );
  const row = rows[0]!;

  const before = current.content.assignees ?? [];
  const after = input.patch.assignees;
  const changed = touchesAssignees && JSON.stringify(before) !== JSON.stringify(after);
  if (changed) {
    await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'schedule_note.assignees', $3)`, [
      input.eventId,
      input.actorId,
      JSON.stringify({ key: input.key, before, after }),
    ]);
  }
  return { kind: 'saved', row, assigneesChanged: changed ? { before, after } : null };
}
