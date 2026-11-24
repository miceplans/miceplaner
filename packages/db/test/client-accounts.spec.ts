import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findClientIdByCompanyName, linkClientAccount, listClientAccounts, portalEvents, portalPrograms, withContext, type DbContext } from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { admin: id(9101), staff: id(9102), client: id(9103), member: id(9104) };
const CO = id(9201);
const OTHER_CO = id(9202);
const EVENT = id(9301);
const OTHER_EVENT = id(9302);
const PROGRAM = id(9401);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { admin: ctx(U.admin, 'super_admin'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client') };

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1, '연결관리자', 'link-admin@x.test', 'super_admin'), ($2, '연결직원', 'link-staff@x.test', 'staff'),
       ($3, '연결고객', 'link-client@x.test', 'client'), ($4, '연결멤버', 'link-member@x.test', 'staff')`,
    [U.admin, U.staff, U.client, U.member],
  );
  await admin.query(`INSERT INTO client_applications (company_name, applicant_name, email, password_hash, status) VALUES (' 연결 테스트사 ', '연결고객', 'link-client@x.test', 'x', 'approved')`);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '연결 테스트사'), ($2, '다른 고객사')`, [CO, OTHER_CO]);
  await admin.query(
    `INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, '연결 행사', '2026-12-01', '2026-12-02'), ($3, $4, '다른 행사', '2026-12-03', '2026-12-04')`,
    [EVENT, CO, OTHER_EVENT, OTHER_CO],
  );
  await admin.query(`INSERT INTO event_items (id, event_id, kind, title, client_visible, created_by) VALUES ($1, $2, 'program', '개막', true, $3)`, [PROGRAM, EVENT, U.member]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

describe('Client 계정의 고객사 연결 (F-07)', () => {
  it('연결 전에는 포털에 고객사 행사가 보이지 않는다', async () => {
    expect(await withContext(app, as.client, (db) => portalEvents(db))).toEqual([]);
  });

  it('신청 회사명은 공백·대소문자를 무시하고 하나만 일치할 때 고객사를 찾는다', async () => {
    expect(await withContext(app, as.admin, (db) => findClientIdByCompanyName(db, '연결 테스트사  '))).toBe(CO);
    expect(await withContext(app, as.admin, (db) => findClientIdByCompanyName(db, '없는 회사'))).toBeUndefined();
  });

  it('Super Admin이 아니면 연결할 수 없다', async () => {
    await expect(withContext(app, as.staff, (db) => linkClientAccount(db, U.client, CO))).rejects.toMatchObject({ code: '42501' });
  });

  it('내부 직원 계정은 고객사에 연결할 수 없다', async () => {
    await expect(withContext(app, as.admin, (db) => linkClientAccount(db, U.staff, CO))).rejects.toMatchObject({ code: 'P0002' });
    await expect(admin.query(`UPDATE users SET client_id = $2 WHERE id = $1`, [U.staff, CO])).rejects.toMatchObject({ code: '23514' });
  });

  it('연결하면 그 고객사의 행사와 공개 Program만 포털에 보이고 감사 로그를 남긴다', async () => {
    const row = await withContext(app, as.admin, (db) => linkClientAccount(db, U.client, CO));
    expect(row).toMatchObject({ id: U.client, clientId: CO, companyName: ' 연결 테스트사 ' });
    expect(await withContext(app, as.client, (db) => portalEvents(db))).toMatchObject([{ eventId: EVENT }]);
    expect(await withContext(app, as.client, (db) => portalPrograms(db))).toMatchObject([{ eventId: EVENT, programId: PROGRAM }]);
    const log = await admin.query(`SELECT detail FROM audit_log WHERE action = 'client.account.link' AND detail->>'userId' = $1`, [U.client]);
    expect(log.rows).toEqual([{ detail: { userId: U.client, beforeClientId: null, clientId: CO } }]);
  });

  it('내부 직원은 연결 상태를 조회하고, 신청 회사명은 Super Admin에게만 보인다', async () => {
    const staffView = (await withContext(app, as.staff, (db) => listClientAccounts(db))).find((a) => a.id === U.client);
    expect(staffView).toMatchObject({ clientId: CO, companyName: null });
    // Client는 users RLS상 자기 행만 볼 수 있다 (API는 Client의 조회 자체를 막는다).
    expect((await withContext(app, as.client, (db) => listClientAccounts(db))).map((a) => a.id)).toEqual([U.client]);
  });

  it('연결을 해제하면 포털에서 다시 사라진다', async () => {
    await withContext(app, as.admin, (db) => linkClientAccount(db, U.client, null));
    expect(await withContext(app, as.client, (db) => portalEvents(db))).toEqual([]);
  });
});
