import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getScheduleNote, saveScheduleNote, withContext, type DbContext } from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { member: id(9501), staff: id(9502), client: id(9503) };
const CO = id(9601);
const EVENT = id(9701);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { member: ctx(U.member, 'staff'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client') };

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1, '메모멤버', 'note-member@x.test', 'staff'), ($2, '메모직원', 'note-staff@x.test', 'staff'), ($3, '메모고객', 'note-client@x.test', 'client')`,
    [U.member, U.staff, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '메모 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, '메모 행사', '2026-12-01', '2026-12-02')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1, $2, 'pm')`, [EVENT, U.member]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

const save = (who: DbContext, key: string, eventId: string | null, baseVersion: number, patch: Record<string, unknown>) =>
  withContext(app, who, (db) => saveScheduleNote(db, { key, eventId, baseVersion, patch, actorId: who.userId }));

describe('일정 상세 메모 (F-04)', () => {
  it('행사 없는 날짜 메모는 내부 직원 누구나 저장하고, 바뀐 필드만 덮어쓴다', async () => {
    expect(await save(as.staff, 'day:2026-11-10', null, 0, { description: '첫 메모' })).toMatchObject({ kind: 'saved', row: { version: 1 } });
    const second = await save(as.member, 'day:2026-11-10', null, 0, { clientMemo: '고객 요청' });
    expect(second).toMatchObject({ kind: 'saved', row: { version: 2, content: { description: '첫 메모', clientMemo: '고객 요청' } } });
    expect(await withContext(app, as.staff, (db) => getScheduleNote(db, 'day:2026-11-10'))).toMatchObject({ version: 2, eventId: null });
  });

  it('담당자 변경은 version이 다르면 충돌이고, 바뀌면 감사 로그를 남긴다', async () => {
    expect(await save(as.staff, 'day:2026-11-10', null, 1, { assignees: ['메모직원'] })).toEqual({ kind: 'conflict', currentVersion: 2 });
    expect(await save(as.staff, 'day:2026-11-10', null, 2, { assignees: ['메모직원'] })).toMatchObject({ kind: 'saved', assigneesChanged: { before: [], after: ['메모직원'] } });
    const { rows } = await admin.query(`SELECT actor_id, detail FROM audit_log WHERE action = 'schedule_note.assignees'`);
    expect(rows).toMatchObject([{ actor_id: U.staff, detail: { key: 'day:2026-11-10', after: ['메모직원'] } }]);
  });

  it('행사에 묶인 메모는 행사 멤버만 저장한다', async () => {
    const key = `event:${EVENT}:a`;
    expect(await save(as.member, key, EVENT, 0, { description: '리허설' })).toMatchObject({ kind: 'saved' });
    await expect(save(as.staff, key, EVENT, 1, { description: '덮어쓰기' })).rejects.toMatchObject({ code: '42501' });
    await expect(save(as.staff, `event:${EVENT}:b`, EVENT, 0, { description: '새 메모' })).rejects.toMatchObject({ code: '42501' });
    // 행사 없는 키로 바꿔 권한을 우회할 수 없다
    await expect(save(as.staff, key, null, 1, { description: '우회' })).rejects.toMatchObject({ code: '42501' });
    expect(await save(as.member, key, null, 1, { description: '우회' })).toEqual({ kind: 'event_mismatch' });
    expect(await withContext(app, as.staff, (db) => getScheduleNote(db, key))).toMatchObject({ content: { description: '리허설' } });
  });

  it('Client는 메모를 보거나 저장할 수 없다', async () => {
    expect(await withContext(app, as.client, (db) => getScheduleNote(db, 'day:2026-11-10'))).toBeUndefined();
    await expect(save(as.client, 'day:2026-11-11', null, 0, { description: 'x' })).rejects.toMatchObject({ code: '42501' });
  });
});
