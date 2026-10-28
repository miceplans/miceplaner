import type { PoolClient } from 'pg';

export type PortalEventRow = { eventId: string; name: string; startDate: string; endDate: string; place: string };
export type PortalProgramRow = { eventId: string; programId: string; title: string; startsOn: string | null; dueOn: string | null };

/** Client는 내부 표에 접근하지 못하고 공개 전용 함수만 호출한다. 필터는 함수 안에 있다. */
export async function portalEvents(client: PoolClient): Promise<PortalEventRow[]> {
  const { rows } = await client.query<PortalEventRow>(`SELECT event_id AS "eventId", name, to_char(start_date, 'YYYY-MM-DD') AS "startDate", to_char(end_date, 'YYYY-MM-DD') AS "endDate", place FROM portal_events()`);
  return rows;
}

export async function portalPrograms(client: PoolClient): Promise<PortalProgramRow[]> {
  const { rows } = await client.query<PortalProgramRow>(
    `SELECT event_id AS "eventId", program_id AS "programId", title, to_char(starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(due_on, 'YYYY-MM-DD') AS "dueOn" FROM portal_programs()`,
  );
  return rows;
}
