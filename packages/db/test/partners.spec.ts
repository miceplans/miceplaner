import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPartnerField, deletePartner, deletePartnerField, listPartnerFields, listPartners, renamePartnerField, savePartner, withContext, type DbContext, type PartnerInput,
} from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { a: id(9901), b: id(9902), client: id(9903) };
const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { a: ctx(U.a, 'staff'), b: ctx(U.b, 'staff'), client: ctx(U.client, 'client') };

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1, '협력가', 'partner-a@x.test', 'staff'), ($2, '협력나', 'partner-b@x.test', 'staff'), ($3, '협력고객', 'partner-c@x.test', 'client')`,
    [U.a, U.b, U.client],
  );
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

const partner = (pid: string, over: Partial<PartnerInput> = {}): PartnerInput => ({ id: pid, name: '가나인쇄', field: '출력·인쇄', manager: '', phone: '', email: '', memo: '', ...over });

describe('협력사 (F-14)', () => {
  it('한 직원이 등록하면 다른 직원이 보고 고치며 Client는 보지도 쓰지도 못한다', async () => {
    const pid = id(9911);
    await withContext(app, as.a, (db) => savePartner(db, U.a, partner(pid)));
    expect(await withContext(app, as.b, (db) => savePartner(db, U.b, partner(pid, { phone: '02-1' })))).toMatchObject({ phone: '02-1' });
    expect(await withContext(app, as.a, (db) => listPartners(db))).toMatchObject([{ id: pid, phone: '02-1' }]);
    const { rows } = await admin.query('SELECT created_by, updated_by FROM partners WHERE id = $1', [pid]);
    expect(rows[0]).toEqual({ created_by: U.a, updated_by: U.b });
    expect(await withContext(app, as.client, (db) => listPartners(db))).toEqual([]);
    expect(await withContext(app, as.client, (db) => listPartnerFields(db))).toEqual([]);
    await expect(withContext(app, as.client, (db) => savePartner(db, U.client, partner(id(9912))))).rejects.toThrow();
    await expect(withContext(app, as.client, (db) => createPartnerField(db, '몰래'))).rejects.toThrow();
    expect(await withContext(app, as.client, (db) => deletePartner(db, pid))).toBe(false);
    await expect(withContext(app, as.a, (db) => savePartner(db, U.b, partner(id(9913))))).rejects.toThrow();
  });

  it('삭제는 soft delete이고 감사 로그를 남기며 삭제된 id는 되살릴 수 없다', async () => {
    const pid = id(9921);
    await withContext(app, as.a, (db) => savePartner(db, U.a, partner(pid)));
    expect(await withContext(app, as.b, (db) => deletePartner(db, pid))).toBe(true);
    expect(await withContext(app, as.b, (db) => deletePartner(db, pid))).toBe(false);
    const { rows } = await admin.query(`SELECT actor_id, detail->>'name' AS name FROM audit_log WHERE action = 'partner.delete' AND detail->>'partnerId' = $1`, [pid]);
    expect(rows).toEqual([{ actor_id: U.b, name: '가나인쇄' }]);
    const revived = await withContext(app, as.a, (db) => savePartner(db, U.a, partner(pid))).catch(() => undefined);
    expect(revived).toBeUndefined();
    const { rows: kept } = await admin.query('SELECT deleted_at FROM partners WHERE id = $1', [pid]);
    expect(kept[0].deleted_at).not.toBeNull();
  });

  it('태그 이름을 바꾸면 쓰는 협력사도 바뀌고, 지운 이름은 다시 만들 수 있다', async () => {
    const pid = id(9931);
    const field = await withContext(app, as.a, (db) => createPartnerField(db, '케이터링'));
    await withContext(app, as.a, (db) => savePartner(db, U.a, partner(pid, { field: '케이터링' })));
    await expect(withContext(app, as.b, (db) => createPartnerField(db, '케이터링'))).rejects.toThrow();
    expect(await withContext(app, as.b, (db) => renamePartnerField(db, U.b, field.id, '식음료'))).toEqual({ id: field.id, name: '식음료' });
    expect((await withContext(app, as.a, (db) => listPartners(db))).find((p) => p.id === pid)!.field).toBe('식음료');
    expect(await withContext(app, as.a, (db) => deletePartnerField(db, field.id))).toBe(true);
    expect((await withContext(app, as.a, (db) => listPartners(db))).find((p) => p.id === pid)!.field).toBe('식음료');
    expect((await withContext(app, as.a, (db) => createPartnerField(db, '식음료'))).name).toBe('식음료');
  });
});
