import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createItem, deleteEventCalendarBlock, deleteEventProduct, listEventCalendarBlocks, listEventProducts, listItems, saveEventCalendarBlock, saveEventProduct,
  updateItem, withContext, type DbContext, type EventProductInput,
} from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { member: id(9801), staff: id(9802), client: id(9803) };
const CO = id(9811);
const EVENT = id(9821);
const OTHER = id(9822);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { member: ctx(U.member, 'staff'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client') };

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1, '목록멤버', 'list-member@x.test', 'staff'), ($2, '목록직원', 'list-staff@x.test', 'staff'), ($3, '목록고객', 'list-client@x.test', 'client')`,
    [U.member, U.staff, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '목록 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $3, '목록 행사', '2026-12-01', '2026-12-02'), ($2, $3, '다른 행사', '2026-12-01', '2026-12-02')`, [EVENT, OTHER, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1, $3, 'member'), ($2, $3, 'member')`, [EVENT, OTHER, U.member]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

const product = (pid: string, over: Partial<EventProductInput> = {}): EventProductInput => ({
  id: pid, name: '배너', part: '디자인', dueOn: '2026-11-30', size: '', qty: '', material: '', vendor: '', contact: '', note: '', negotiating: false, status: 'draft', ...over,
});

describe('행사 상세 목록 서버 저장 (F-04)', () => {
  it('스케줄은 클라이언트 id와 시작·종료 분을 저장하고, 순서가 뒤집힌 시각은 거부한다', async () => {
    const pid = id(9831);
    const program = await withContext(app, as.member, (db) =>
      createItem(db, U.member, { id: pid, eventId: EVENT, kind: 'program', parentId: null, title: '리허설', dueOn: '2026-12-01', startMinute: 600, endMinute: 660 }));
    expect(program).toMatchObject({ id: pid, startMinute: 600, endMinute: 660, dueOn: '2026-12-01' });
    await expect(withContext(app, as.member, (db) => updateItem(db, pid, { startMinute: 700 }))).rejects.toThrow();
    const rows = await withContext(app, as.staff, (db) => listItems(db, EVENT));
    expect(rows.find((r) => r.id === pid)).toMatchObject({ startMinute: 600, endMinute: 660 });
  });

  it('제작물은 행사 멤버만 저장·삭제하고 내부 직원은 모두 보며 Client는 못 본다', async () => {
    const pid = id(9841);
    expect(await withContext(app, as.member, (db) => saveEventProduct(db, U.member, EVENT, product(pid)))).toMatchObject({ id: pid, eventId: EVENT, dueOn: '2026-11-30' });
    expect(await withContext(app, as.member, (db) => saveEventProduct(db, U.member, EVENT, product(pid, { status: 'pending', name: '현수막' })))).toMatchObject({ status: 'pending', name: '현수막' });
    await expect(withContext(app, as.staff, (db) => saveEventProduct(db, U.staff, EVENT, product(id(9842))))).rejects.toThrow();
    expect(await withContext(app, as.staff, (db) => listEventProducts(db, EVENT))).toHaveLength(1);
    expect(await withContext(app, as.client, (db) => listEventProducts(db, EVENT))).toHaveLength(0);
    expect(await withContext(app, as.staff, (db) => deleteEventProduct(db, pid))).toBe(false);
    expect(await withContext(app, as.member, (db) => deleteEventProduct(db, pid))).toBe(true);
    expect(await withContext(app, as.member, (db) => listEventProducts(db, EVENT))).toHaveLength(0);
  });

  it('같은 id로 다른 행사의 제작물을 덮어쓸 수 없다', async () => {
    const pid = id(9843);
    await withContext(app, as.member, (db) => saveEventProduct(db, U.member, EVENT, product(pid)));
    expect(await withContext(app, as.member, (db) => saveEventProduct(db, U.member, OTHER, product(pid, { name: '탈취' })))).toBeUndefined();
    expect((await withContext(app, as.member, (db) => listEventProducts(db, EVENT))).find((p) => p.id === pid)).toMatchObject({ name: '배너' });
  });

  it('캘린더 블록은 행사 멤버만 저장·삭제하고 시각 순서를 검사한다', async () => {
    const bid = id(9851);
    const block = { id: bid, title: '리허설', date: '2026-12-01', startMinute: 540, endMinute: 600 };
    expect(await withContext(app, as.member, (db) => saveEventCalendarBlock(db, U.member, EVENT, block))).toMatchObject(block);
    expect(await withContext(app, as.member, (db) => saveEventCalendarBlock(db, U.member, EVENT, { ...block, startMinute: 600, endMinute: 630 }))).toMatchObject({ startMinute: 600 });
    await expect(withContext(app, as.member, (db) => saveEventCalendarBlock(db, U.member, EVENT, { ...block, endMinute: 500 }))).rejects.toThrow();
    await expect(withContext(app, as.staff, (db) => saveEventCalendarBlock(db, U.staff, EVENT, { ...block, id: id(9852) }))).rejects.toThrow();
    expect(await withContext(app, as.client, (db) => listEventCalendarBlocks(db, EVENT))).toHaveLength(0);
    expect(await withContext(app, as.staff, (db) => deleteEventCalendarBlock(db, bid))).toBe(false);
    expect(await withContext(app, as.member, (db) => deleteEventCalendarBlock(db, bid))).toBe(true);
    expect(await withContext(app, as.staff, (db) => listEventCalendarBlocks(db, EVENT))).toHaveLength(0);
  });
});
