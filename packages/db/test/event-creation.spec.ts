import pg from 'pg';
import { eventListItemDto, notificationDto } from '@miceplans/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addEventMember, createEvent, getEvent, listEventMembers, listNotifications, removeEventMember, transferPm, withContext, type DbContext,
} from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { staff: id(6011), member: id(6012), admin: id(6013), client: id(6014) };
const CO = id(6201);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = {
  staff: ctx(U.staff, 'staff'),
  member: ctx(U.member, 'member'),
  admin: ctx(U.admin, 'super_admin'),
  client: ctx(U.client, 'client'),
};

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(
    `INSERT INTO users (id, name, email, role, annual_leave_days) VALUES
       ($1, 'staff', 'create-staff@x.test', 'staff', 3), ($2, 'member', 'create-member@x.test', 'staff', 3),
       ($3, 'admin', 'create-admin@x.test', 'super_admin', 3), ($4, 'client', 'create-client@x.test', 'client', 3)`,
    [U.staff, U.member, U.admin, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '행사생성 고객사')`, [CO]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

const newEvent = (c: DbContext, name: string) =>
  withContext(app, c, (db) => createEvent(db, { clientId: CO, name, startDate: '2026-09-10', endDate: '2026-09-12' }));

describe('행사 생성 (F-02)', () => {
  it('Staff는 행사를 만들고 자신이 PM으로 등록되며 감사 로그가 남는다', async () => {
    const event = await newEvent(as.staff, '신규 행사');
    expect(event).toMatchObject({ clientId: CO, name: '신규 행사', status: '진행중', createdBy: U.staff });
    expect(eventListItemDto.parse(event)).toMatchObject({ clientName: '행사생성 고객사', pmName: 'staff', amName: null });
    expect(await withContext(app, as.staff, (db) => listEventMembers(db, event.id))).toEqual([{ eventId: event.id, userId: U.staff, role: 'pm' }]);
    const log = await admin.query(`SELECT action FROM audit_log WHERE event_id = $1`, [event.id]);
    expect(log.rows).toContainEqual({ action: 'event.create' });
  });
  it('Client는 행사를 만들 수 없다', async () => {
    await expect(newEvent(as.client, 'x')).rejects.toThrow(/낮은 직원만/);
  });
  it('앱 역할은 events에 직접 INSERT할 수 없다 (생성은 함수 경로만 허용)', async () => {
    await expect(
      withContext(app, as.staff, (db) => db.query(`INSERT INTO events (client_id, name, start_date, end_date) VALUES ($1, 'x', '2026-09-10', '2026-09-11')`, [CO])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('생성자의 PM 재진입 차단 (0012)', () => {
  it('PM을 넘기고 남겨진 생성자는 멤버가 아니므로 스스로 PM으로 돌아올 수 없다', async () => {
    const event = await newEvent(as.staff, '인수인계');
    await withContext(app, as.staff, (db) => addEventMember(db, U.staff, event.id, U.member, 'member'));
    expect(await withContext(app, as.staff, (db) => transferPm(db, event.id, U.staff, U.member))).toBe(true);
    // 새 PM이 생성자를 행사에서 내보낸다.
    await withContext(app, as.member, (db) => removeEventMember(db, U.member, event.id, U.staff));
    await expect(
      withContext(app, as.staff, (db) => db.query(`INSERT INTO event_members VALUES ($1, $2, 'pm')`, [event.id, U.staff])),
    ).rejects.toThrow(/row-level security/);
  });
  it('created_by는 PM이 바뀌어도 유지되고 아무도 바꿀 수 없다', async () => {
    const event = await newEvent(as.staff, '소유자 고정');
    await withContext(app, as.staff, (db) => addEventMember(db, U.staff, event.id, U.member, 'pm'));
    await withContext(app, as.member, (db) => removeEventMember(db, U.member, event.id, U.staff));
    expect((await withContext(app, as.member, (db) => getEvent(db, event.id)))?.createdBy).toBe(U.staff);
    await expect(
      withContext(app, as.member, (db) => db.query(`UPDATE events SET created_by = $2 WHERE id = $1`, [event.id, U.member])),
    ).rejects.toThrow(/created_by는 변경할 수 없다/);
  });
});

describe('PM 넘기기 (F-02, F-06)', () => {
  it('Super Admin이 만든 행사는 Super Admin이 다른 멤버에게 PM을 넘긴다', async () => {
    const event = await newEvent(as.admin, '관리자 행사');
    expect(await withContext(app, as.admin, (db) => listEventMembers(db, event.id))).toEqual([{ eventId: event.id, userId: U.admin, role: 'pm' }]);
    await withContext(app, as.admin, (db) => addEventMember(db, U.admin, event.id, U.staff, 'member'));
    expect(await withContext(app, as.admin, (db) => transferPm(db, event.id, U.admin, U.staff))).toBe(true);
    expect(await withContext(app, as.admin, (db) => listEventMembers(db, event.id))).toEqual([
      { eventId: event.id, userId: U.admin, role: 'member' },
      { eventId: event.id, userId: U.staff, role: 'pm' },
    ]);
  });
  it('행사 멤버가 아닌 사람에게는 넘길 수 없다', async () => {
    const event = await newEvent(as.staff, '대상 제한');
    expect(await withContext(app, as.staff, (db) => transferPm(db, event.id, U.staff, U.member))).toBe(false);
  });
  it('PM 넘기기는 양쪽에 pm_transferred 알림을 남기고 멤버 추가 알림은 다시 보내지 않는다', async () => {
    const event = await newEvent(as.staff, '알림 확인');
    await withContext(app, as.staff, (db) => addEventMember(db, U.staff, event.id, U.member, 'am'));
    await withContext(app, as.staff, (db) => transferPm(db, event.id, U.staff, U.member));
    const received = await withContext(app, as.member, (db) => listNotifications(db));
    const given = await withContext(app, as.staff, (db) => listNotifications(db));
    for (const n of [...received, ...given]) expect(notificationDto.parse(n)).toBeDefined();
    expect(received.find((n) => n.kind === 'pm_transferred')?.title).toContain('넘겨받았습니다');
    expect(given.find((n) => n.kind === 'pm_transferred')?.title).toContain('넘겼습니다');
    // 받는 사람은 이미 멤버이므로 '추가' 알림은 멤버 추가 시점의 1건만 있다.
    expect(received.filter((n) => n.kind === 'member_changed' && n.eventId === event.id && n.title.includes('추가'))).toHaveLength(1);
    const log = await admin.query(`SELECT action FROM audit_log WHERE event_id = $1 AND action = 'member.pm.transfer'`, [event.id]);
    expect(log.rowCount).toBe(1);
  });
});
