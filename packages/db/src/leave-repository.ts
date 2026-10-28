import type { PoolClient } from 'pg';
import { isoTs } from './sql';
import { leaveDays, type LeaveKind } from '@miceplans/domain';

export type LeaveRow = { id: string; userId: string; date: string; kind: LeaveKind; days: number; createdAt: string };

const COLUMNS = `id, user_id AS "userId", to_char(leave_date, 'YYYY-MM-DD') AS date, kind, days::float8 AS days, ${isoTs('created_at', 'createdAt')}`;

/** 내부 직원은 모두의 사용 내역을 본다. month(1~12)를 주면 그 달만 돌려준다. */
export async function listLeave(client: PoolClient, year: number, month?: number): Promise<LeaveRow[]> {
  const { rows } = await client.query<LeaveRow>(
    `SELECT ${COLUMNS} FROM leave_requests WHERE extract(year FROM leave_date) = $1 AND ($2::int IS NULL OR extract(month FROM leave_date) = $2) ORDER BY leave_date, user_id`,
    [year, month ?? null],
  );
  return rows;
}

export type LeaveBalanceRow = { userId: string; name: string; jobTitle: string; total: number; used: number; monthly: number[]; compEarned: number; compUsed: number };

/** 직원별 연차 사용 현황. 대휴는 연차 사용 일수에서 제외한다. */
export async function leaveBalances(client: PoolClient, year: number): Promise<LeaveBalanceRow[]> {
  const { rows } = await client.query(
    `SELECT u.id AS "userId", u.name, u.job_title AS "jobTitle", u.annual_leave_days::float8 AS total,
       coalesce(sum(l.days) FILTER (WHERE l.kind <> 'comp'), 0)::float8 AS used,
       array(SELECT coalesce(sum(l2.days), 0)::float8 FROM generate_series(1, 12) m
             LEFT JOIN leave_requests l2 ON l2.user_id = u.id AND l2.kind <> 'comp' AND l2.deleted_at IS NULL
               AND extract(year FROM l2.leave_date) = $1 AND extract(month FROM l2.leave_date) = m GROUP BY m ORDER BY m) AS monthly,
       coalesce(sum(l.days) FILTER (WHERE l.kind = 'comp'), 0)::float8 AS "compUsed",
       coalesce(w.days, 0)::float8 AS "compEarned"
     FROM users u LEFT JOIN leave_requests l ON l.user_id = u.id AND l.deleted_at IS NULL AND extract(year FROM l.leave_date) = $1
     LEFT JOIN weekend_work_year_counts($1::int) w ON w.user_id = u.id
     GROUP BY u.id, w.days ORDER BY u.name`,
    [year],
  );
  return rows;
}

/** 본인 명의로만 신청된다 (RLS). 잔여 일수 초과는 DB가 check_violation으로 거부한다. */
export async function requestLeave(client: PoolClient, userId: string, kind: LeaveKind, dates: string[]): Promise<LeaveRow[]> {
  const out: LeaveRow[] = [];
  for (const date of dates) {
    const { rows } = await client.query<LeaveRow>(`INSERT INTO leave_requests (user_id, leave_date, kind, days) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`, [userId, date, kind, leaveDays(kind)]);
    out.push(rows[0]!);
  }
  return out;
}

/** 취소는 soft delete다. 본인 것이 아니면 false. */
export async function cancelLeave(client: PoolClient, id: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>('SELECT cancel_leave_request($1) AS ok', [id]);
  return rows[0]!.ok;
}

export async function setWeekendWork(client: PoolClient, userId: string, date: string, worked: boolean): Promise<void> {
  if (worked) await client.query(`INSERT INTO weekend_work (user_id, work_date) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, date]);
  else await client.query(`DELETE FROM weekend_work WHERE user_id = $1 AND work_date = $2`, [userId, date]);
}

export async function listWeekendWork(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ d: string }>(`SELECT to_char(work_date, 'YYYY-MM-DD') AS d FROM weekend_work ORDER BY work_date`);
  return rows.map((r) => r.d);
}
