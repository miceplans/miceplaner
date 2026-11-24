import type { PoolClient } from 'pg';
import { isoTs } from './sql';

export type NoticeRow = {
  id: string;
  eventId: string | null;
  eventName: string | null;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  dismissedAt: string | null;
};

const FROM = `FROM notices n
  JOIN users u ON u.id = n.created_by
  LEFT JOIN events e ON e.id = n.event_id
  LEFT JOIN notice_dismissals d ON d.notice_id = n.id AND d.user_id = app_user_id()`;
const COLUMNS = `n.id, n.event_id AS "eventId", e.name AS "eventName", n.title, n.body, n.created_by AS "authorId",
  u.name AS "authorName", ${isoTs('n.created_at', 'createdAt')}, ${isoTs('d.dismissed_at', 'dismissedAt')}`;

/** 내가 볼 수 있는 공지를 돌려준다. 닫지 않은 공지가 최상단에 오고 각각 최신순이다 (명세 F-13). */
export async function listNotices(client: PoolClient): Promise<NoticeRow[]> {
  const { rows } = await client.query<NoticeRow>(
    `SELECT ${COLUMNS} ${FROM} WHERE n.deleted_at IS NULL
     ORDER BY (d.dismissed_at IS NULL) DESC, n.created_at DESC`,
  );
  return rows;
}

/** 내가 볼 수 있는 공지 한 건. 없거나 볼 수 없으면 undefined (RLS). */
export async function getNotice(client: PoolClient, id: string): Promise<NoticeRow | undefined> {
  const { rows } = await client.query<NoticeRow>(`SELECT ${COLUMNS} ${FROM} WHERE n.id = $1 AND n.deleted_at IS NULL`, [id]);
  return rows[0];
}

/**
 * 공지를 올린다. 전체 공지는 Super Admin만, 행사 공지는 그 행사의 PM·AM(과 Super Admin)이 올린다 (RLS).
 * 생성 감사 로그를 같은 트랜잭션에 남긴다.
 */
export async function createNotice(client: PoolClient, actorId: string, eventId: string | null, title: string, body: string): Promise<NoticeRow> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO notices (event_id, title, body, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [eventId, title, body, actorId],
  );
  const id = rows[0]!.id;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'notice.create', $3)`, [
    eventId,
    actorId,
    JSON.stringify({ noticeId: id, title }),
  ]);
  return (await getNotice(client, id))!;
}

/**
 * 공지 삭제는 soft delete다. 작성자와 Super Admin만 한다 (soft_delete_notice 내부 권한 검사).
 * 삭제 감사 로그는 함수가 남긴다.
 */
export async function softDeleteNotice(client: PoolClient, id: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>(`SELECT soft_delete_notice($1) AS ok`, [id]);
  return rows[0]!.ok;
}

/** 내가 볼 수 있는 공지를 닫는다. 이미 닫았거나 볼 수 없는 공지면 undefined. 닫기는 되돌리지 않는다 (명세 F-13). */
export async function dismissNotice(client: PoolClient, userId: string, id: string): Promise<NoticeRow | undefined> {
  const visible = await client.query(`SELECT id FROM notices WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!visible.rows[0]) return undefined;
  await client.query(`INSERT INTO notice_dismissals (notice_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
  return getNotice(client, id);
}
