import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listDocs, setDocVisibility, withContext, type DbContext } from '../src';

const EVENT = '00000000-0000-0000-0000-0000000000e1';
const U = { pm: '00000000-0000-0000-0000-000000000001', am: '00000000-0000-0000-0000-000000000002', member: '00000000-0000-0000-0000-000000000003', staff: '00000000-0000-0000-0000-000000000004', client: '00000000-0000-0000-0000-000000000005', admin: '00000000-0000-0000-0000-000000000006' };
const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });

let app: pg.Pool;
let docs: Record<'all' | 'members' | 'managers', string>;

beforeAll(async () => {
  const admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'am'), ($1,$4,'member')`, [EVENT, U.pm, U.am, U.member]);
  const ids = await Promise.all(
    (['all', 'members', 'managers'] as const).map(async (v) => (await admin.query(`INSERT INTO event_docs (event_id, title, visibility) VALUES ($1,$2,$2) RETURNING id`, [EVENT, v])).rows[0].id as string),
  );
  docs = { all: ids[0]!, members: ids[1]!, managers: ids[2]! };
  await admin.end();
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => app.end());

const titles = (c: DbContext) => withContext(app, c, async (db) => (await listDocs(db, EVENT)).map((d) => d.title));

describe('앱 역할', () => {
  it('BYPASSRLS가 없다', async () => {
    const { rows } = await app.query(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`);
    expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
  });
  it('컨텍스트 없이 직접 조회하면 아무 문서도 보이지 않는다', async () => {
    expect((await app.query('SELECT 1 FROM event_docs')).rowCount).toBe(0);
  });
});

describe('문서 열람 범위 RLS', () => {
  it('PM·AM·Super Admin은 모든 문서를 본다', async () => {
    for (const c of [ctx(U.pm, 'member'), ctx(U.am, 'member'), ctx(U.admin, 'super_admin')]) expect(await titles(c)).toEqual(['all', 'managers', 'members']);
  });
  it('행사 멤버는 PM·AM만 문서를 못 본다', async () => expect(await titles(ctx(U.member, 'member'))).toEqual(['all', 'members']));
  it('비멤버 Staff는 전체 공개 문서만 본다', async () => expect(await titles(ctx(U.staff, 'staff'))).toEqual(['all']));
  it('Client는 아무 문서도 보지 못한다', async () => expect(await titles(ctx(U.client, 'client'))).toEqual([]));
});

describe('열람 범위 변경', () => {
  it('PM은 변경할 수 있고 감사 로그가 남는다', async () => {
    const result = await withContext(app, ctx(U.pm, 'member'), (db) => setDocVisibility(db, docs.all, 'members', 1, U.pm));
    expect(result).toMatchObject({ visibility: 'members', version: 2 });
    const log = await withContext(app, ctx(U.pm, 'member'), (db) => db.query(`SELECT action, actor_id FROM audit_log`));
    expect(log.rows).toEqual([{ action: 'doc.visibility.change', actor_id: U.pm }]);
  });
  it('version이 낡으면 충돌로 null을 돌려준다', async () => {
    expect(await withContext(app, ctx(U.pm, 'member'), (db) => setDocVisibility(db, docs.all, 'all', 1, U.pm))).toBeNull();
  });
  it('행사 멤버는 변경할 수 없다 (RLS로 0행)', async () => {
    expect(await withContext(app, ctx(U.member, 'member'), (db) => setDocVisibility(db, docs.members, 'all', 1, U.member))).toBeNull();
  });
  it('Client는 변경할 수 없다', async () => {
    expect(await withContext(app, ctx(U.client, 'client'), (db) => setDocVisibility(db, docs.members, 'all', 1, U.client))).toBeNull();
  });
});
