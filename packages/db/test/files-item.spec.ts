import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createItem, getFile, insertFile, listFiles, moveFile, softDeleteEvent, softDeleteItem, withContext, type DbContext } from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(5011), member: id(5012), staff: id(5013), client: id(5014) };
const EVENT = id(5101);
const OTHER = id(5102);
const TMP = id(5103);
const CO = id(5201);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { pm: ctx(U.pm, 'member'), member: ctx(U.member, 'member'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client') };

let app: pg.Pool;
let admin: pg.Pool;
let program: string;
let otherProgram: string;

const upload = (c: DbContext, name: string, opts: { itemId?: string | null; eventId?: string } = {}) =>
  withContext(app, c, (db) => insertFile(db, { eventId: opts.eventId ?? EVENT, itemId: opts.itemId ?? null, name, mime: 'text/plain', sizeBytes: 10, storageKey: `k/${name}-${Math.random()}`, uploadedBy: c.userId }));

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email, role) VALUES ($1, $2, 'fi-' || $2 || '@x.test', $3)`, [uid, name, name === 'client' ? 'client' : 'staff']);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '항목 첨부 고객사')`, [CO]);
  for (const e of [EVENT, OTHER, TMP]) await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, $3, '2026-03-13', '2026-03-16')`, [e, CO, `fi-${e.slice(-3)}`]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member')`, [EVENT, U.pm, U.member]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm')`, [OTHER, U.pm]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm')`, [TMP, U.pm]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
  program = (await withContext(app, as.pm, (db) => createItem(db, U.pm, { eventId: EVENT, kind: 'program', parentId: null, title: '개막식' }))).id;
  otherProgram = (await withContext(app, as.pm, (db) => createItem(db, U.pm, { eventId: OTHER, kind: 'program', parentId: null, title: '타 행사' }))).id;
});
afterAll(async () => { await app.end(); await admin.end(); });

describe('event_files 항목 첨부 (F-04)', () => {
  it('항목에 첨부하고 itemId 조건으로 조회한다', async () => {
    const f = await upload(as.pm, '견적.txt', { itemId: program });
    expect(f).toMatchObject({ eventId: EVENT, itemId: program, uploadedBy: U.pm });
    const filtered = await withContext(app, as.pm, (db) => listFiles(db, EVENT, { itemId: program }));
    expect(filtered.map((r) => r.id)).toEqual([f.id]);
  });
  it('다른 행사의 항목에는 첨부하거나 옮길 수 없다', async () => {
    await expect(upload(as.pm, 'x.txt', { itemId: otherProgram })).rejects.toMatchObject({ code: '23514' });
    const f = await upload(as.pm, '이동.txt');
    await expect(withContext(app, as.pm, (db) => moveFile(db, f.id, otherProgram))).rejects.toMatchObject({ code: '23514' });
  });
  it('멤버·스태프는 항목 이동할 수 없다', async () => {
    const f = await upload(as.pm, '권한.txt');
    expect(await withContext(app, as.member, (db) => moveFile(db, f.id, program))).toBeUndefined();
    expect(await withContext(app, as.staff, (db) => moveFile(db, f.id, program))).toBeUndefined();
    expect((await withContext(app, as.pm, (db) => getFile(db, f.id)))?.itemId).toBeNull();
    expect((await withContext(app, as.pm, (db) => moveFile(db, f.id, program)))?.itemId).toBe(program);
    expect((await withContext(app, as.pm, (db) => moveFile(db, f.id, null)))?.itemId).toBeNull();
  });
  it('Client는 첨부 메타데이터를 보지 못한다', async () => {
    const f = await upload(as.pm, '비공개.txt', { itemId: program });
    expect(await withContext(app, as.client, (db) => getFile(db, f.id))).toBeUndefined();
    expect(await withContext(app, as.client, (db) => listFiles(db, EVENT))).toEqual([]);
  });
});

describe('event_files 삭제 연쇄 (명세 3.1)', () => {
  it('항목 삭제는 첨부 파일까지 함께 삭제한다', async () => {
    const p = await withContext(app, as.pm, (db) => createItem(db, U.pm, { eventId: EVENT, kind: 'program', parentId: null, title: '삭제용' }));
    const f = await upload(as.pm, '하위.txt', { itemId: p.id });
    expect(await withContext(app, as.pm, (db) => softDeleteItem(db, p.id))).toBe(true);
    expect(await withContext(app, as.pm, (db) => getFile(db, f.id))).toBeUndefined();
    expect((await admin.query(`SELECT deleted_at FROM event_files WHERE id = $1`, [f.id])).rows[0]!.deleted_at).not.toBeNull();
  });
  it('행사 삭제는 첨부 파일까지 함께 삭제한다', async () => {
    const f = await upload(as.pm, '행사.txt', { eventId: TMP });
    expect(await withContext(app, as.pm, (db) => softDeleteEvent(db, U.pm, TMP))).toBe(true);
    expect((await admin.query(`SELECT deleted_at FROM event_files WHERE id = $1`, [f.id])).rows[0]!.deleted_at).not.toBeNull();
  });
});
