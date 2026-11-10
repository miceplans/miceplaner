import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addEventCreatorAsPm, getImportJob, insertEvent, insertImportJob, markImportJobDone, withContext, type DbContext,
} from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { a: id(81), b: id(82), client: id(83) };
const CO = id(281);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const asA = ctx(U.a, 'member');
const asB = ctx(U.b, 'member');
const asClient = ctx(U.client, 'client');

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email) VALUES ($1, $2, $2 || '@import.test')`, [uid, name]);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '고객사')`, [CO]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

describe('import_jobs RLS', () => {
  it('만든 사람만 작업을 보고, 남의 작업은 보이지 않는다', async () => {
    const job = await withContext(app, asA, (db) => insertImportJob(db, { fileName: 'a.xlsx', file: Buffer.from('x'), sheets: [{ name: '시트1', rowCount: 3 }], createdBy: U.a }));
    expect((await withContext(app, asA, (db) => getImportJob(db, job.id)))?.fileName).toBe('a.xlsx');
    expect(await withContext(app, asB, (db) => getImportJob(db, job.id))).toBeUndefined();
    // 다른 사람 명의로는 만들 수 없다
    await expect(withContext(app, asA, (db) => insertImportJob(db, { fileName: 'b.xlsx', file: Buffer.from('x'), sheets: [], createdBy: U.b }))).rejects.toThrow(/row-level security/);
    // Client는 만들 수 없다
    await expect(withContext(app, asClient, (db) => insertImportJob(db, { fileName: 'c.xlsx', file: Buffer.from('x'), sheets: [], createdBy: U.client }))).rejects.toThrow(/row-level security/);
  });

  it('완료 처리하면 원본 바이트와 그리드가 지워진다', async () => {
    const job = await withContext(app, asA, (db) => insertImportJob(db, { fileName: 'done.xlsx', file: Buffer.from('원본'), sheets: [], createdBy: U.a }));
    await withContext(app, asA, async (db) => {
      await markImportJobDone(db, job.id, { created: 1, failed: [], warnings: [], failedTruncated: false, warningsTruncated: false, finishedAt: new Date().toISOString() });
    });
    const { rows } = await admin.query(`SELECT file, rows FROM import_jobs WHERE id = $1`, [job.id]);
    expect(rows[0]).toMatchObject({ file: null, rows: null });
  });
});

describe('행사 생성 정책', () => {
  it('낮은 권한은 본인을 생성 주체로 넣어 행사를 만들 수 있다', async () => {
    const eventId = await withContext(app, asA, (db) => insertEvent(db, { clientId: CO, name: '가져온 행사', startDate: '2025-03-06', endDate: '2025-03-08', place: '코엑스', status: '진행중', createdBy: U.a }));
    const { rows } = await admin.query(`SELECT created_by FROM events WHERE id = $1`, [eventId]);
    expect(rows[0]).toMatchObject({ created_by: U.a });
  });
  it('다른 사람 명의로는 만들 수 없고 Client는 만들 수 없다', async () => {
    await expect(withContext(app, asA, (db) => insertEvent(db, { clientId: CO, name: 'x', startDate: '2025-03-06', endDate: '2025-03-08', place: '', status: '진행중', createdBy: U.b }))).rejects.toThrow(/row-level security/);
    await expect(withContext(app, asClient, (db) => insertEvent(db, { clientId: CO, name: 'x', startDate: '2025-03-06', endDate: '2025-03-08', place: '', status: '진행중', createdBy: U.client }))).rejects.toThrow(/row-level security/);
  });
  it('새 행사의 만든 사람을 PM 멤버로 넣을 수 있고 Client는 못 넣는다', async () => {
    const eventId = await withContext(app, asA, (db) => insertEvent(db, { clientId: CO, name: 'PM 테스트', startDate: '2025-03-06', endDate: '2025-03-08', place: '', status: '진행중', createdBy: U.a }));
    await withContext(app, asA, (db) => addEventCreatorAsPm(db, eventId, U.a));
    const { rows } = await admin.query(`SELECT role FROM event_members WHERE event_id = $1 AND user_id = $2`, [eventId, U.a]);
    expect(rows[0]).toMatchObject({ role: 'pm' });
    const denied = await withContext(app, asClient, (db) => addEventCreatorAsPm(db, eventId, U.client));
    expect(denied).toBeUndefined();
    const { rows: after } = await admin.query(`SELECT count(*)::int AS n FROM event_members WHERE event_id = $1 AND user_id = $2`, [eventId, U.client]);
    expect(after[0]).toMatchObject({ n: 0 });
  });
});
