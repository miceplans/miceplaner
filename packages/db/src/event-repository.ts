import type { PoolClient } from 'pg';
import { isoTs } from './sql';
import { isRole, type EventStatus, type Role } from '@miceplans/domain';

export type EventRow = {
  id: string; clientId: string; name: string; startDate: string; endDate: string; place: string; status: EventStatus;
  priority: boolean; color: string | null; version: number; createdBy: string | null; createdAt: string; updatedAt: string;
};

const COLUMNS = `id, client_id AS "clientId", name, to_char(start_date, 'YYYY-MM-DD') AS "startDate", to_char(end_date, 'YYYY-MM-DD') AS "endDate",
  place, status, priority, color, version, created_by AS "createdBy", ${isoTs('created_at', 'createdAt')}, ${isoTs('updated_at', 'updatedAt')}`;

/** 조회 필터는 날짜·고객사·상태다. 권한 밖 행사는 RLS가 걸러낸다. */
export async function listEvents(client: PoolClient, filter: { year?: number; clientId?: string; status?: string }): Promise<EventRow[]> {
  const cond: string[] = [];
  const vals: unknown[] = [];
  if (filter.year !== undefined) {
    vals.push(`${filter.year}-01-01`, `${filter.year + 1}-01-01`);
    cond.push(`start_date >= $${vals.length - 1}::date AND start_date < $${vals.length}::date`);
  }
  if (filter.clientId) { vals.push(filter.clientId); cond.push(`client_id = $${vals.length}`); }
  if (filter.status) { vals.push(filter.status); cond.push(`status = $${vals.length}`); }
  const { rows } = await client.query<EventRow>(`SELECT ${COLUMNS} FROM events ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY start_date, name`, vals);
  return rows;
}

export async function getEvent(client: PoolClient, id: string): Promise<EventRow | undefined> {
  const { rows } = await client.query<EventRow>(`SELECT ${COLUMNS} FROM events WHERE id = $1`, [id]);
  return rows[0];
}

export type EventPatch = { name?: string; startDate?: string; endDate?: string; place?: string; status?: EventStatus; priority?: boolean; color?: string | null };

/** 일반 필드는 마지막 저장 우선이라 version을 받지 않는다. 권한이 없거나 대상이 없으면 undefined다 (RLS). */
export async function updateEvent(client: PoolClient, id: string, patch: EventPatch): Promise<EventRow | undefined> {
  const sets: string[] = ['version = version + 1'];
  const vals: unknown[] = [];
  const put = (column: string, value: unknown) => { vals.push(value); sets.push(`${column} = $${vals.length}`); };
  if (patch.name !== undefined) put('name', patch.name);
  if (patch.startDate !== undefined) put('start_date', patch.startDate);
  if (patch.endDate !== undefined) put('end_date', patch.endDate);
  if (patch.place !== undefined) put('place', patch.place);
  if (patch.status !== undefined) put('status', patch.status);
  if (patch.priority !== undefined) put('priority', patch.priority);
  if (patch.color !== undefined) put('color', patch.color);
  vals.push(id);
  const { rows } = await client.query<EventRow>(`UPDATE events SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING ${COLUMNS}`, vals);
  return rows[0];
}

/** 현재 주체의 행사 안 역할. 비멤버 내외 직원은 staff다 (RLS 함수와 같은 규칙). */
export async function eventRole(client: PoolClient, eventId: string): Promise<Role> {
  const { rows } = await client.query<{ role: string }>(`SELECT current_event_role($1) AS role`, [eventId]);
  const role = rows[0]?.role;
  return isRole(role) ? role : 'staff';
}

export type EventMemberRole = 'pm' | 'am' | 'member';
export type EventMemberRow = { eventId: string; userId: string; role: EventMemberRole };

export async function listEventMembers(client: PoolClient, eventId: string): Promise<EventMemberRow[]> {
  const { rows } = await client.query<EventMemberRow>(`SELECT event_id AS "eventId", user_id AS "userId", role FROM event_members WHERE event_id = $1 ORDER BY role, user_id`, [eventId]);
  return rows;
}

/** 멤버 추가는 PM·AM(과 Super Admin)만 할 수 있다 (RLS). 당사자에게 알림을 남기고 감사 로그를 쓴다. */
export async function addEventMember(client: PoolClient, actorId: string, eventId: string, userId: string, role: EventMemberRole): Promise<EventMemberRow> {
  const { rows } = await client.query<EventMemberRow>(`INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, $3) RETURNING event_id AS "eventId", user_id AS "userId", role`, [eventId, userId, role]);
  const row = rows[0]!;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'member.add', $3)`, [eventId, actorId, JSON.stringify({ userId, role })]);
  await notifyMemberChanged(client, eventId, userId, 'add');
  return row;
}

/** 최소 한 명의 PM 유지와 권한은 DB가 검사한다. 당사자에게 알림을 남기고 감사 로그를 쓴다. */
export async function removeEventMember(client: PoolClient, actorId: string, eventId: string, userId: string): Promise<boolean> {
  const { rows } = await client.query<{ role: EventMemberRole }>(`DELETE FROM event_members WHERE event_id = $1 AND user_id = $2 RETURNING role`, [eventId, userId]);
  const row = rows[0];
  if (!row) return false;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'member.remove', $3)`, [eventId, actorId, JSON.stringify({ userId, role: row.role })]);
  await notifyMemberChanged(client, eventId, userId, 'remove');
  return true;
}

/** 역할 변경은 권한 변경이라 감사 로그 대상이다 (명세 3.1). */
export async function changeEventMemberRole(client: PoolClient, actorId: string, eventId: string, userId: string, role: EventMemberRole): Promise<EventMemberRow | undefined> {
  const { rows } = await client.query<EventMemberRow>(`UPDATE event_members SET role = $3 WHERE event_id = $1 AND user_id = $2 RETURNING event_id AS "eventId", user_id AS "userId", role`, [eventId, userId, role]);
  const row = rows[0];
  if (!row) return undefined;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'member.role.change', $3)`, [eventId, actorId, JSON.stringify({ userId, role })]);
  return row;
}

/** 지정된 Client 목록. 조회는 행사 관리자만 한다 (RLS). */
export async function listEventClients(client: PoolClient, eventId: string): Promise<string[]> {
  const { rows } = await client.query<{ userId: string }>(`SELECT client_user_id AS "userId" FROM event_clients WHERE event_id = $1 ORDER BY client_user_id`, [eventId]);
  return rows.map((r) => r.userId);
}

/** Client 지정·해제는 감사 로그 대상이다 (명세 3.1). */
export async function setEventClient(client: PoolClient, actorId: string, eventId: string, userId: string, assigned: boolean): Promise<boolean> {
  if (assigned) {
    await client.query(`INSERT INTO event_clients (event_id, client_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [eventId, userId]);
  } else {
    await client.query(`DELETE FROM event_clients WHERE event_id = $1 AND client_user_id = $2`, [eventId, userId]);
  }
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'event.client.change', $3)`, [eventId, actorId, JSON.stringify({ userId, assigned })]);
  return assigned;
}

async function notifyMemberChanged(client: PoolClient, eventId: string, userId: string, change: 'add' | 'remove') {
  const { rows } = await client.query<{ name: string }>(`SELECT name FROM events WHERE id = $1`, [eventId]);
  const title = rows[0]?.name ?? '행사';
  await client.query(`INSERT INTO notifications (recipient_id, event_id, kind, title) VALUES ($1, $2, 'member_changed', $3)`, [userId, eventId, `${title} (${change === 'add' ? '추가' : '삭제'})`]);
}

// ── 사용자·고객사 조회 ──────────────────────────────────────────────────────

export type UserRow = { id: string; name: string; email: string; jobTitle: string; role: Role; annualLeaveDays: number };

const USER_COLUMNS = `id, name, email, job_title AS "jobTitle", role, annual_leave_days::float8 AS "annualLeaveDays"`;

/** 낮은 권한 주체는 RLS가 걸러낸다. 목록은 낮은 권한만 볼 수 있다. */
export async function listUsers(client: PoolClient): Promise<UserRow[]> {
  const { rows } = await client.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users ORDER BY name`);
  return rows;
}

export async function getUserById(client: PoolClient, id: string): Promise<UserRow | undefined> {
  const { rows } = await client.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0];
}

/** 로그인 시 이메일로 사용자를 찾는다. */
export async function findUserByEmail(client: PoolClient, email: string): Promise<UserRow | undefined> {
  const { rows } = await client.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [email]);
  return rows[0];
}

/** 가입 시 만든다. 역할은 기본 staff다. */
export async function insertUser(client: PoolClient, user: { id: string; name: string; email: string; passwordHash?: string }): Promise<UserRow> {
  const { rows } = await client.query<UserRow>(
    `INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
    [user.id, user.name, user.email, user.passwordHash ?? null],
  );
  return rows[0]!;
}

/** 로그인 검증용. 비밀번호 해시는 이 함수들 밖으로 내보내지 않는다. */
export async function getPasswordHash(client: PoolClient, id: string): Promise<string | null> {
  const { rows } = await client.query<{ hash: string | null }>(`SELECT password_hash AS hash FROM users WHERE id = $1`, [id]);
  return rows[0]?.hash ?? null;
}

/** 비밀번호가 아직 없는 계정에만 설정한다. 동시 가입에서 한쪽만 성공하도록 조건을 UPDATE에 둔다. */
export async function setInitialPasswordHash(client: PoolClient, id: string, hash: string): Promise<boolean> {
  const { rowCount } = await client.query(`UPDATE users SET password_hash = $2 WHERE id = $1 AND password_hash IS NULL`, [id, hash]);
  return rowCount === 1;
}

/** 본인 행만 바꿀 수 있다(RLS users_update). 반영 여부를 돌려준다. */
export async function setPasswordHash(client: PoolClient, id: string, hash: string): Promise<boolean> {
  const { rowCount } = await client.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, hash]);
  return rowCount === 1;
}

/** 이름이 바뀌었을 때만 동기화한다. 역할은 바꾸지 않는다. */
export async function updateUserName(client: PoolClient, id: string, name: string): Promise<UserRow | undefined> {
  const { rows } = await client.query<UserRow>(`UPDATE users SET name = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`, [id, name]);
  return rows[0];
}

export type ClientRow = { id: string; name: string };

export async function listClients(client: PoolClient): Promise<ClientRow[]> {
  const { rows } = await client.query<ClientRow>(`SELECT id, name FROM clients ORDER BY name`);
  return rows;
}
