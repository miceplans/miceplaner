import pg from 'pg';
import { eventItemDto, leaveRecordDto, notificationDto } from '@miceplans/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assignItem, cancelLeave, createItem, leaveBalances, listItems, listLeave, listNotifications, markNotificationsRead, portalEvents, portalPrograms,
  requestLeave, rescheduleItem, setClientVisible, setWeekendWork, softDeleteEvent, softDeleteItem, transferEventRole, updateEvent, withContext, type DbContext,
} from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(11), am: id(12), member: id(13), staff: id(14), client: id(15), admin: id(16), outsider: id(17) };
const EVENT = id(101);
const OTHER_EVENT = id(102);
const CLIENT_CO = id(201);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { pm: ctx(U.pm, 'member'), am: ctx(U.am, 'member'), member: ctx(U.member, 'member'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client'), admin: ctx(U.admin, 'super_admin') };

let app: pg.Pool;
let admin: pg.Pool;
let program: string;
let hiddenProgram: string;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email, annual_leave_days) VALUES ($1, $2, $2 || '@x.test', 3)`, [uid, name]);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '고객사')`, [CLIENT_CO]);
  for (const e of [EVENT, OTHER_EVENT]) await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, $3, '2026-03-13', '2026-03-16')`, [e, CLIENT_CO, `event-${e.slice(-3)}`]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'am'), ($1,$4,'member')`, [EVENT, U.pm, U.am, U.member]);
  await admin.query(`INSERT INTO event_clients VALUES ($1, $2)`, [EVENT, U.client]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

const newProgram = (c: DbContext, title: string, actor = c.userId) => withContext(app, c, (db) => createItem(db, actor, { eventId: EVENT, kind: 'program', parentId: null, title }));

describe('Program·Task·Subtask', () => {
  it('행사 멤버는 만들 수 있고 Staff·Client는 만들 수 없다', async () => {
    program = (await newProgram(as.member, '개막식')).id;
    hiddenProgram = (await newProgram(as.pm, '비공개 리허설')).id;
    await expect(newProgram(as.staff, 'x')).rejects.toThrow(/row-level security/);
    await expect(newProgram(as.client, 'x')).rejects.toThrow(/row-level security/);
  });
  it('비멤버 내부 직원은 다른 행사 항목을 만들 수 없다', async () => {
    await expect(withContext(app, ctx(U.outsider, 'member'), (db) => createItem(db, U.outsider, { eventId: EVENT, kind: 'program', parentId: null, title: 'x' }))).rejects.toThrow(/row-level security/);
  });
  it('다른 사람 명의로는 만들 수 없다', async () => {
    await expect(newProgram(as.member, 'x', U.pm)).rejects.toThrow(/row-level security/);
  });
  it('상위 항목 종류가 틀리면 거부한다', async () => {
    await expect(withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'subtask', parentId: program, title: 'x' }))).rejects.toThrow(/상위 항목 종류/);
  });
  it('Staff는 조회하고 Client는 내부 표를 볼 수 없다', async () => {
    expect((await withContext(app, as.staff, (db) => listItems(db, EVENT))).length).toBe(2);
    expect(await withContext(app, as.client, (db) => listItems(db, EVENT))).toEqual([]);
  });
  it('담당자는 행사 멤버만 지정할 수 있다', async () => {
    const task = await withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'task', parentId: program, title: '인쇄', assigneeId: U.am }));
    expect(task.assigneeId).toBe(U.am);
    await expect(withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'task', parentId: program, title: 'y', assigneeId: U.outsider }))).rejects.toThrow(/행사 멤버여야/);
  });
});

describe('행사 상태·기간 변경 권한', () => {
  it('PM·AM만 상태·기간을 바꾸고 일반 멤버·Staff는 거부된다', async () => {
    const patch = (c: DbContext, p: Parameters<typeof updateEvent>[2]) => withContext(app, c, (db) => updateEvent(db, EVENT, p));
    await expect(patch(as.member, { status: '완료' })).rejects.toMatchObject({ code: '42501' });
    await expect(patch(as.member, { startDate: '2026-03-12' })).rejects.toMatchObject({ code: '42501' });
    await expect(patch(as.member, { name: '멤버가 바꾼 이름' })).resolves.toMatchObject({ name: '멤버가 바꾼 이름' });
    await expect(patch(as.am, { status: '입찰준비중' })).resolves.toMatchObject({ status: '입찰준비중' });
    await expect(patch(as.pm, { endDate: '2026-03-18' })).resolves.toMatchObject({ endDate: '2026-03-18' });
    await expect(patch(as.admin, { status: '진행중', endDate: '2026-03-16' })).resolves.toMatchObject({ status: '진행중' });
  });
  it('PM 양도는 대상을 먼저 PM으로 올려 PM이 비지 않고, 멤버가 아닌 대상은 거부한다', async () => {
    const roles = async () => (await admin.query(`SELECT user_id, role FROM event_members WHERE event_id = $1`, [EVENT])).rows.reduce((m, r) => ({ ...m, [r.user_id]: r.role }), {} as Record<string, string>);
    expect(await withContext(app, as.pm, (db) => transferEventRole(db, U.pm, EVENT, 'pm', U.outsider))).toBeUndefined();
    await withContext(app, as.pm, (db) => transferEventRole(db, U.pm, EVENT, 'pm', U.member));
    expect(await roles()).toMatchObject({ [U.member]: 'pm', [U.pm]: 'member' });
    await withContext(app, as.member, (db) => transferEventRole(db, U.member, EVENT, 'pm', U.pm));
    expect(await roles()).toMatchObject({ [U.pm]: 'pm', [U.member]: 'member' });
  });
});

describe('버전 검사와 감사·알림', () => {
  it('담당자 변경은 version이 낡으면 null이고, 성공하면 감사 로그와 알림이 남는다', async () => {
    const item = await withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'task', parentId: program, title: '디자인' }));
    expect(await withContext(app, as.member, (db) => assignItem(db, U.member, item.id, U.pm, 99))).toBeNull();
    const done = await withContext(app, as.member, (db) => assignItem(db, U.member, item.id, U.pm, item.version));
    expect(done).toMatchObject({ assigneeId: U.pm, version: 2 });
    const [n] = await withContext(app, as.pm, (db) => listNotifications(db));
    expect(n).toMatchObject({ kind: 'assigned', title: '디자인', readAt: null });
    const log = await withContext(app, as.pm, (db) => db.query(`SELECT action FROM audit_log WHERE action = 'item.assignee.change'`));
    expect(log.rowCount).toBe(1);
  });
  it('마감일 변경도 version을 검사하고 담당자에게 알림을 보낸다', async () => {
    const item = await withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'task', parentId: program, title: '일정', assigneeId: U.am }));
    expect(await withContext(app, as.member, (db) => rescheduleItem(db, item.id, null, '2026-03-05', 5))).toBeNull();
    expect(await withContext(app, as.member, (db) => rescheduleItem(db, item.id, null, '2026-03-05', 1))).toMatchObject({ dueOn: '2026-03-05', version: 2 });
    const kinds = (await withContext(app, as.am, (db) => listNotifications(db))).map((x) => x.kind);
    expect(kinds).toContain('schedule_changed');
  });
  it('알림은 수신자 본인만 보고 읽음 처리한다', async () => {
    expect((await withContext(app, as.staff, (db) => listNotifications(db))).length).toBe(0);
    const mine = await withContext(app, as.pm, (db) => listNotifications(db));
    expect(await withContext(app, as.pm, (db) => markNotificationsRead(db, mine.map((x) => x.id)))).toBe(mine.length);
    expect(await withContext(app, as.am, (db) => markNotificationsRead(db, mine.map((x) => x.id)))).toBe(0);
  });
});

describe('Client 포털', () => {
  it('공개하지 않은 Program은 보이지 않는다', async () => {
    expect(await withContext(app, as.client, (db) => portalPrograms(db))).toEqual([]);
  });
  it('공개한 Program의 이름과 일정만 보인다', async () => {
    await withContext(app, as.member, (db) => setClientVisible(db, U.member, program, true, 1));
    const rows = await withContext(app, as.client, (db) => portalPrograms(db));
    expect(rows).toEqual([{ eventId: EVENT, programId: program, title: '개막식', startsOn: null, dueOn: null }]);
    expect(Object.keys(rows[0]!).sort()).toEqual(['dueOn', 'eventId', 'programId', 'startsOn', 'title']);
    expect(await withContext(app, as.client, (db) => portalEvents(db))).toMatchObject([{ eventId: EVENT }]);
  });
  it('지정되지 않은 Client와 내부 직원은 포털 모델이 비어 있다', async () => {
    expect(await withContext(app, ctx(id(99), 'client'), (db) => portalPrograms(db))).toEqual([]);
    expect(await withContext(app, as.member, (db) => portalPrograms(db))).toEqual([]);
  });
  it('Task는 공개할 수 없다', async () => {
    const t = await withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'task', parentId: program, title: '내부' }));
    await expect(withContext(app, as.member, (db) => setClientVisible(db, U.member, t.id, true, t.version))).rejects.toThrow(/check constraint/);
  });
  it('공개 변경은 감사 로그를 남긴다', async () => {
    const log = await withContext(app, as.pm, (db) => db.query(`SELECT 1 FROM audit_log WHERE action = 'item.client_visible.change'`));
    expect(log.rowCount).toBe(1);
  });
});

describe('삭제', () => {
  it('Program 삭제는 하위 Task·Subtask까지 함께 삭제된다', async () => {
    const p = await newProgram(as.member, '삭제용');
    const t = await withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'task', parentId: p.id, title: 't' }));
    await withContext(app, as.member, (db) => createItem(db, U.member, { eventId: EVENT, kind: 'subtask', parentId: t.id, title: 's' }));
    expect(await withContext(app, as.member, (db) => softDeleteItem(db, p.id))).toBe(true);
    const left = (await withContext(app, as.member, (db) => listItems(db, EVENT))).map((i) => i.id);
    expect(left).not.toContain(p.id);
    expect(left).not.toContain(t.id);
    const { rows } = await admin.query(`SELECT count(*)::int AS n FROM event_items WHERE parent_id = $1 OR id = $1 OR parent_id = $2`, [p.id, t.id]);
    expect(rows[0].n).toBe(3);
  });
  it('Staff는 삭제할 수 없다', async () => {
    expect(await withContext(app, as.staff, (db) => softDeleteItem(db, hiddenProgram))).toBe(false);
  });
  it('행사 삭제는 PM만 할 수 있고 항목도 함께 삭제된다', async () => {
    await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'tmp', '2026-01-01', '2026-01-02')`, [id(103), CLIENT_CO]);
    await admin.query(`INSERT INTO event_members VALUES ($1, $2, 'pm'), ($1, $3, 'am')`, [id(103), U.pm, U.am]);
    await withContext(app, as.pm, (db) => createItem(db, U.pm, { eventId: id(103), kind: 'program', parentId: null, title: 'p' }));
    await expect(withContext(app, as.am, (db) => softDeleteEvent(db, U.am, id(103)))).rejects.toThrow(/PM만/);
    await expect(withContext(app, as.am, (db) => db.query(`UPDATE events SET deleted_at = now() WHERE id = $1`, [id(103)]))).rejects.toThrow(/PM만/);
    await expect(withContext(app, as.pm, (db) => db.query(`UPDATE events SET deleted_at = now() WHERE id = $1`, [id(103)]))).rejects.toThrow(/row-level security/);
    expect(await withContext(app, as.pm, (db) => softDeleteEvent(db, U.pm, id(103)))).toBe(true);
    expect((await admin.query(`SELECT deleted_at FROM event_items WHERE event_id = $1`, [id(103)])).rows[0].deleted_at).not.toBeNull();
  });
});

describe('행사 멤버', () => {
  it('PM·AM은 추가·삭제하고 행사 멤버는 못 한다', async () => {
    await withContext(app, as.am, (db) => db.query(`INSERT INTO event_members VALUES ($1, $2, 'member')`, [EVENT, U.staff]));
    await expect(withContext(app, as.member, (db) => db.query(`INSERT INTO event_members VALUES ($1, $2, 'member')`, [EVENT, U.outsider]))).rejects.toThrow(/row-level security/);
    await withContext(app, as.am, (db) => db.query(`DELETE FROM event_members WHERE event_id = $1 AND user_id = $2`, [EVENT, U.staff]));
  });
  it('마지막 PM은 삭제할 수 없다', async () => {
    await expect(withContext(app, as.pm, (db) => db.query(`DELETE FROM event_members WHERE event_id = $1 AND user_id = $2`, [EVENT, U.pm]))).rejects.toThrow(/최소 한 명의 PM/);
  });
});

describe('휴가', () => {
  it('본인 명의로만 신청하고 모두의 내역을 본다', async () => {
    await withContext(app, as.member, (db) => requestLeave(db, U.member, 'full', ['2026-10-21']));
    await expect(withContext(app, as.member, (db) => requestLeave(db, U.pm, 'full', ['2026-10-22']))).rejects.toThrow(/row-level security/);
    expect((await withContext(app, as.staff, (db) => listLeave(db, 2026))).map((r) => r.userId)).toEqual([U.member]);
    expect(await withContext(app, as.client, (db) => listLeave(db, 2026))).toEqual([]);
  });
  it('연간 연차를 넘으면 거부한다', async () => {
    await withContext(app, as.member, (db) => requestLeave(db, U.member, 'am-half', ['2026-10-22']));
    await expect(withContext(app, as.member, (db) => requestLeave(db, U.member, 'full', ['2026-10-26', '2026-10-27', '2026-10-28']))).rejects.toThrow(/잔여 일수/);
  });
  it('주말 날짜에는 신청할 수 없다', async () => {
    await expect(withContext(app, as.am, (db) => requestLeave(db, U.am, 'full', ['2026-10-24']))).rejects.toThrow(/check constraint/);
  });
  it('대휴는 주말 근무 일수까지만 쓸 수 있다', async () => {
    await expect(withContext(app, as.am, (db) => requestLeave(db, U.am, 'comp', ['2026-10-26']))).rejects.toThrow(/잔여 일수/);
    await withContext(app, as.am, (db) => setWeekendWork(db, U.am, '2026-10-24', true));
    await withContext(app, as.am, (db) => requestLeave(db, U.am, 'comp', ['2026-10-26']));
  });
  it('연차 현황은 대휴를 제외하고 월별로 집계한다', async () => {
    const rows = await withContext(app, as.am, (db) => leaveBalances(db, 2026));
    const member = rows.find((r) => r.userId === U.member)!;
    expect(member).toMatchObject({ total: 3, used: 1.5, compUsed: 0 });
    expect(member.monthly[9]).toBe(1.5);
    expect(rows.find((r) => r.userId === U.am)).toMatchObject({ used: 0, compUsed: 1, compEarned: 1 });
  });
  it('취소는 soft delete이고 본인 것만 가능하다', async () => {
    const [r] = await withContext(app, as.member, (db) => listLeave(db, 2026));
    expect(await withContext(app, as.pm, (db) => cancelLeave(db, r!.id))).toBe(false);
    expect(await withContext(app, as.member, (db) => cancelLeave(db, r!.id))).toBe(true);
  });
  it('주말 근무는 본인만 본다', async () => {
    expect((await withContext(app, as.pm, (db) => db.query(`SELECT 1 FROM weekend_work`))).rowCount).toBe(0);
  });
});

describe('repository 반환값은 응답 DTO 계약을 만족한다', () => {
  it('항목', async () => {
    const items = await withContext(app, as.member, (db) => listItems(db, EVENT));
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) expect(eventItemDto.parse(i)).toBeDefined();
  });
  it('알림 (timestamptz는 UTC ISO 문자열)', async () => {
    const rows = await withContext(app, as.am, (db) => listNotifications(db));
    expect(rows.length).toBeGreaterThan(0);
    for (const n of rows) expect(notificationDto.parse(n)).toBeDefined();
    expect(typeof rows[0]!.createdAt).toBe('string');
  });
  it('휴가', async () => {
    const rows = await withContext(app, as.am, (db) => listLeave(db, 2026));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(leaveRecordDto.parse(r)).toBeDefined();
  });
  it('휴가 월 필터', async () => {
    expect((await withContext(app, as.am, (db) => listLeave(db, 2026, 10))).length).toBeGreaterThan(0);
    expect(await withContext(app, as.am, (db) => listLeave(db, 2026, 11))).toEqual([]);
  });
});
