import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNotice, dismissNotice, getNotice, listNotices, softDeleteNotice, withContext, type DbContext } from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { admin: id(9301), pm: id(9302), member: id(9303), outsider: id(9304), client: id(9305) };
const CO = id(9306);
const EVENT = id(9307);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = {
  admin: ctx(U.admin, 'super_admin'),
  pm: ctx(U.pm, 'staff'),
  member: ctx(U.member, 'staff'),
  outsider: ctx(U.outsider, 'staff'),
  client: ctx(U.client, 'client'),
};

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES
       ($1, '공지관리자', 'notice-admin@x.test', 'super_admin'),
       ($2, '공지PM', 'notice-pm@x.test', 'staff'),
       ($3, '공지멤버', 'notice-member@x.test', 'staff'),
       ($4, '공지외부', 'notice-outsider@x.test', 'staff'),
       ($5, '공지고객', 'notice-client@x.test', 'client')`,
    [U.admin, U.pm, U.member, U.outsider, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '공지 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, '공지 행사', '2026-12-01', '2026-12-02')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1, $2, 'pm'), ($1, $3, 'member')`, [EVENT, U.pm, U.member]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

describe('공지 (F-13)', () => {
  it('Super Admin은 전체 공지를 올리고 내부 직원 전원이 본다', async () => {
    const notice = await withContext(app, as.admin, (db) => createNotice(db, U.admin, null, '전체 공지', '내용'));
    expect(notice).toMatchObject({ eventId: null, title: '전체 공지', authorName: '공지관리자' });
    for (const who of [as.admin, as.pm, as.member, as.outsider]) {
      expect(await withContext(app, who, (db) => listNotices(db))).toEqual([
        expect.objectContaining({ id: notice.id, dismissedAt: null }),
      ]);
    }
    expect(await withContext(app, as.client, (db) => listNotices(db))).toEqual([]);
  });

  it('행사 공지는 그 행사의 PM·AM이 올리고 행사 멤버만 본다', async () => {
    const notice = await withContext(app, as.pm, (db) => createNotice(db, U.pm, EVENT, '행사 공지', '행사 내용'));
    expect(notice.eventName).toBe('공지 행사');
    expect(await withContext(app, as.member, (db) => getNotice(db, notice.id))).toMatchObject({ title: '행사 공지' });
    expect(await withContext(app, as.outsider, (db) => getNotice(db, notice.id))).toBeUndefined();
    // 외부 직원은 전체 공지만 보고 행사 공지는 목록에 없다.
    const outsiderIds = (await withContext(app, as.outsider, (db) => listNotices(db))).map((n) => n.id);
    expect(outsiderIds).not.toContain(notice.id);
    expect((await withContext(app, as.outsider, (db) => listNotices(db))).every((n) => n.eventId === null)).toBe(true);
    expect(await withContext(app, as.client, (db) => getNotice(db, notice.id))).toBeUndefined();
    expect(await withContext(app, as.client, (db) => listNotices(db))).toEqual([]);
  });

  it('Super Admin은 멤버가 아닌 행사에도 공지를 올린다', async () => {
    const notice = await withContext(app, as.admin, (db) => createNotice(db, U.admin, EVENT, '관리자 행사 공지', '내용'));
    expect(await withContext(app, as.member, (db) => getNotice(db, notice.id))).toMatchObject({ title: '관리자 행사 공지' });
  });

  it('일반 직원과 행사 멤버는 공지를 올릴 수 없다', async () => {
    await expect(withContext(app, as.outsider, (db) => createNotice(db, U.outsider, null, 'x', 'y'))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.outsider, (db) => createNotice(db, U.outsider, EVENT, 'x', 'y'))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.member, (db) => createNotice(db, U.member, EVENT, 'x', 'y'))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.pm, (db) => createNotice(db, U.pm, null, 'x', 'y'))).rejects.toMatchObject({ code: '42501' });
  });

  it('닫기 전까지 공지가 최상단에 고정되고, 닫으면 아래로 난다', async () => {
    const first = await withContext(app, as.admin, (db) => createNotice(db, U.admin, null, '첫 공지', '1'));
    const second = await withContext(app, as.admin, (db) => createNotice(db, U.admin, null, '둘째 공지', '2'));
    const idsOf = async (who: DbContext) => (await withContext(app, who, (db) => listNotices(db))).map((n) => n.id);
    // 닫지 않으면 둘 다 고정이고 최신순이다.
    const ids = await idsOf(as.member);
    expect(ids.indexOf(second.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    expect(await withContext(app, as.member, (db) => dismissNotice(db, U.member, first.id))).toMatchObject({ id: first.id, dismissedAt: expect.any(String) });
    // 첫 공지만 닫았으므로 둘째가 위에, 첫 공지는 닫음 상태로 아래에 남는다.
    const mine = await withContext(app, as.member, (db) => listNotices(db));
    const mineIds = mine.map((n) => n.id);
    expect(mineIds.indexOf(second.id)).toBeLessThan(mineIds.indexOf(first.id));
    expect(mine.find((n) => n.id === second.id)?.dismissedAt).toBeNull();
    expect(mine.find((n) => n.id === first.id)?.dismissedAt).toEqual(expect.any(String));
    // 닫기는 멱등하고, 다른 사람의 상태에는 영향을 주지 않는다.
    expect(await withContext(app, as.member, (db) => dismissNotice(db, U.member, first.id))).toMatchObject({ id: first.id });
    expect((await withContext(app, as.outsider, (db) => listNotices(db))).find((n) => n.id === first.id)?.dismissedAt).toBeNull();
  });

  it('볼 수 없는 공지는 닫을 수 없다', async () => {
    const notice = await withContext(app, as.pm, (db) => createNotice(db, U.pm, EVENT, '행사 전용', 'x'));
    expect(await withContext(app, as.outsider, (db) => dismissNotice(db, U.outsider, notice.id))).toBeUndefined();
  });

  it('공지 삭제는 작성자와 Super Admin만 하고 soft delete다', async () => {
    const own = await withContext(app, as.pm, (db) => createNotice(db, U.pm, EVENT, 'PM 공지', 'x'));
    expect(await withContext(app, as.pm, (db) => softDeleteNotice(db, own.id))).toBe(true);
    expect(await withContext(app, as.member, (db) => getNotice(db, own.id))).toBeUndefined();

    const other = await withContext(app, as.pm, (db) => createNotice(db, U.pm, EVENT, '삭제 시도', 'x'));
    // 작성자가 아니면 내부 권한 오류다.
    await expect(withContext(app, as.member, (db) => softDeleteNotice(db, other.id))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.outsider, (db) => softDeleteNotice(db, other.id))).rejects.toMatchObject({ code: '42501' });
    expect(await withContext(app, as.admin, (db) => softDeleteNotice(db, other.id))).toBe(true);
  });

  it('공지 내용과 범위는 올린 뒤 바꿀 수 없다', async () => {
    const notice = await withContext(app, as.admin, (db) => createNotice(db, U.admin, null, '원본', 'x'));
    await expect(
      withContext(app, as.admin, (db) => db.query(`UPDATE notices SET title = '바꿈' WHERE id = $1`, [notice.id])),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('공지 생성·삭제는 감사 로그에 남는다', async () => {
    const { rows } = await admin.query(`SELECT action, event_id FROM audit_log WHERE action IN ('notice.create', 'notice.delete') ORDER BY id`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.action === 'notice.create' && r.event_id === EVENT)).toBe(true);
    expect(rows.some((r) => r.action === 'notice.delete')).toBe(true);
  });
});
