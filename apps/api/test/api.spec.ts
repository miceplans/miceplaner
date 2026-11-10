import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import { SignJWT } from 'jose';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HiworksService } from '../src/auth/hiworks';
import { Public } from '../src/auth/public.decorator';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(11), member: id(12), staff: id(13), outsider: id(14), target: id(15), admin: id(16), client: id(17), client2: id(18) };
const EVENT = id(101);
const OTHER_EVENT = id(102);
const CO = id(201);
const DOC_MEMBERS = id(301);
const DOC_ALL = id(302);

let app: INestApplication;
let http: Parameters<typeof request>[0];
let admin: TestAdmin;
const tokens: Record<string, string> = {};

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (sub: string, role = 'staff') => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).sign(secret());

const as = (user: keyof typeof U) => ({ Authorization: `Bearer ${tokens[user]}` });
const api = () => request(http);

@Public()
@Controller('__test_boom')
class BoomController {
  @Get()
  boom() {
    throw new Error('테스트용 폭발');
  }
}

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES
       ($1,'PM','pm@x.test','staff'), ($2,'Member','member@x.test','staff'), ($3,'Staff','staff@x.test','staff'),
       ($4,'Outsider','outsider@x.test','staff'), ($5,'Target','target@x.test','staff'),
       ($6,'Admin','admin@x.test','super_admin'), ($7,'Client','client@x.test','client'), ($8,'Client2','client2@x.test','client')`,
    [U.pm, U.member, U.staff, U.outsider, U.target, U.admin, U.client, U.client2],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '고객사')`, [CO]);
  for (const [eid, name] of [[EVENT, 'main-event'], [OTHER_EVENT, 'other-event']]) {
    await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, $3, '2026-03-13', '2026-03-16')`, [eid, CO, name]);
  }
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member')`, [EVENT, U.pm, U.member]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm')`, [OTHER_EVENT, U.pm]);
  await admin.query(`INSERT INTO event_clients VALUES ($1, $2)`, [EVENT, U.client]);
  await admin.query(`INSERT INTO event_docs (id, event_id, title, visibility) VALUES ($1,$2,'멤버 문서','members'), ($3,$2,'전체 문서','all')`, [DOC_MEMBERS, EVENT, DOC_ALL]);

  for (const [name, uid] of Object.entries(U)) tokens[name] = await sign(uid, name === 'client' || name === 'client2' ? 'client' : 'staff');

  const hiworksMembers = new Map([
    ['new@x.test', { email: 'new@x.test', name: '신규' }],
    ['pm@x.test', { email: 'pm@x.test', name: 'PM' }],
    ['client@x.test', { email: 'client@x.test', name: 'Client' }],
  ]);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [BoomController] })
    .overrideProvider(HiworksService)
    .useValue({ findMember: async (email: string) => hiworksMembers.get(email.toLowerCase()) })
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  http = app.getHttpServer();
});

afterAll(async () => {
  await app.close();
  await admin.end();
});

describe('인증 (F-01)', () => {
  it('토큰 없으면 낮은 기능에 접근할 수 없다', async () => {
    await api().get('/events').expect(401);
    await api().get('/auth/me').expect(401);
  });
  it('세션 주체 프로필을 낮는다', async () => {
    const res = await api().get('/auth/me').set(as('member')).expect(200);
    expect(res.body).toMatchObject({ id: U.member, email: 'member@x.test', role: 'staff' });
  });
  it('하이웍스 구성원 이메일로만 가입하고 이메일·비밀번호로 로그인한다', async () => {
    await api().post('/auth/register').send({ email: 'stranger@x.test', password: 'long-enough-pw' }).expect(403);
    await api().post('/auth/register').send({ email: 'new@x.test', password: 'short' }).expect(400);
    const reg = await api().post('/auth/register').send({ email: 'NEW@x.test', password: 'long-enough-pw' }).expect(201);
    expect(reg.body.user).toMatchObject({ email: 'new@x.test', name: '신규', role: 'staff' });
    await api().post('/auth/register').send({ email: 'new@x.test', password: 'another-long-pw' }).expect(409);
    const login = await api().post('/auth/login').send({ email: 'new@x.test', password: 'long-enough-pw' }).expect(200);
    await api().get('/auth/me').set({ Authorization: `Bearer ${login.body.accessToken}` }).expect(200);
    await api().post('/auth/login').send({ email: 'new@x.test', password: 'wrong-password' }).expect(401);
    await api().post('/auth/login').send({ email: 'nobody@x.test', password: 'wrong-password' }).expect(401);
  });
  it('비밀번호가 없는 기존 계정은 가입으로 비밀번호를 설정하고, 로그인 실패 후에도 다시 로그인할 수 있다', async () => {
    await api().post('/auth/register').send({ email: 'pm@x.test', password: 'pm-long-password' }).expect(201);
    for (let i = 0; i < 5; i += 1) await api().post('/auth/login').send({ email: 'pm@x.test', password: 'bad-password-x' }).expect(401);
    await api().post('/auth/login').send({ email: 'pm@x.test', password: 'pm-long-password' }).expect(200);
  });
  it('Client 계정은 이메일 로그인·가입을 쓸 수 없다', async () => {
    await api().post('/auth/register').send({ email: 'client@x.test', password: 'client-long-pw' }).expect(403);
  });
  it('비밀번호를 변경한다', async () => {
    const login = await api().post('/auth/login').send({ email: 'new@x.test', password: 'long-enough-pw' }).expect(200);
    const h = { Authorization: `Bearer ${login.body.accessToken}` };
    await api().post('/auth/password').set(h).send({ currentPassword: 'wrong-password', newPassword: 'brand-new-password' }).expect(401);
    await api().post('/auth/password').set(h).send({ currentPassword: 'long-enough-pw', newPassword: 'brand-new-password' }).expect(204);
    await api().post('/auth/login').send({ email: 'new@x.test', password: 'brand-new-password' }).expect(200);
  });
  it('Client는 낮은 기능에 접근할 수 없다', async () => {
    await api().get('/users').set(as('client')).expect(403);
    await api().get('/events').set(as('client')).expect(403);
    await api().get('/leave?year=2026').set(as('client')).expect(403);
  });
});

describe('행사 관리 (F-02)', () => {
  it('Staff는 전체 행사를 조회하고 편집할 수 없다', async () => {
    const res = await api().get('/events').set(as('staff')).expect(200);
    expect(res.body).toHaveLength(2);
    await api().patch(`/events/${EVENT}`).set(as('staff')).send({ name: '바꿈' }).expect(403);
  });
  it('연도·고객사·상태 필터가 동작한다', async () => {
    expect((await api().get('/events?year=2026').set(as('staff')).expect(200)).body).toHaveLength(2);
    expect((await api().get('/events?year=2025').set(as('staff')).expect(200)).body).toHaveLength(0);
    expect((await api().get(`/events?clientId=${CO}`).set(as('staff')).expect(200)).body).toHaveLength(2);
    expect((await api().get('/events?status=제출').set(as('staff')).expect(200)).body).toHaveLength(0);
  });
  it('행사 멤버는 기본 정보를 수정한다 (마지막 저장 우선)', async () => {
    const res = await api().patch(`/events/${EVENT}`).set(as('member')).send({ name: '개막 행사', priority: true }).expect(200);
    expect(res.body).toMatchObject({ name: '개막 행사', priority: true });
    expect(res.body.version).toBe(2);
  });
  it('비멤버 낮은 직원은 수정할 수 없다', async () => {
    await api().patch(`/events/${EVENT}`).set(as('outsider')).send({ name: 'x' }).expect(403);
  });
  it('행사 삭제는 PM만 하고 하위 항목까지 삭제한다', async () => {
    await api().delete(`/events/${EVENT}`).set(as('member')).expect(403);
    await api().delete(`/events/${OTHER_EVENT}`).set(as('pm')).expect(200);
    await api().get(`/events/${OTHER_EVENT}`).set(as('staff')).expect(404);
    const log = await admin.query(`SELECT action FROM audit_log WHERE action = 'event.delete'`);
    expect(log.rowCount).toBe(1);
  });
});

describe('행사 멤버 관리 (F-02, F-06)', () => {
  it('PM·AM만 멤버를 추가하고 당사자에게 알림이 간다', async () => {
    await api().post(`/events/${EVENT}/members`).set(as('member')).send({ userId: U.target }).expect(403);
    await api().post(`/events/${EVENT}/members`).set(as('pm')).send({ userId: U.target }).expect(201);
    const notices = await api().get('/notifications').set(as('target')).expect(200);
    expect(notices.body[0]).toMatchObject({ kind: 'member_changed', eventId: EVENT });
  });
  it('역할 변경은 PM·AM만 하고 행사에는 항상 최소 한 명의 PM이 남는다', async () => {
    await api().patch(`/events/${EVENT}/members/${U.target}`).set(as('pm')).send({ role: 'pm' }).expect(200);
    await api().delete(`/events/${EVENT}/members/${U.target}`).set(as('pm')).expect(200);
    await api().delete(`/events/${EVENT}/members/${U.pm}`).set(as('pm')).expect(409);
    const log = await admin.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'member.role.change'`);
    expect(log.rows[0].n).toBe(1);
  });
});

describe('Program·Task·Subtask (F-03)', () => {
  let program: string;
  let task: string;
  let subtask: string;

  it('행사 멤버는 계층을 만들고 Staff·비멤버는 만들 수 없다', async () => {
    program = (await api().post(`/events/${EVENT}/items`).set(as('member')).send({ kind: 'program', title: '개막식' }).expect(201)).body.id;
    task = (await api().post(`/events/${EVENT}/items`).set(as('member')).send({ kind: 'task', parentId: program, title: '인쇄' }).expect(201)).body.id;
    subtask = (await api().post(`/events/${EVENT}/items`).set(as('member')).send({ kind: 'subtask', parentId: task, title: '시안' }).expect(201)).body.id;
    await api().post(`/events/${EVENT}/items`).set(as('staff')).send({ kind: 'program', title: 'x' }).expect(403);
    await api().post(`/events/${EVENT}/items`).set(as('outsider')).send({ kind: 'program', title: 'x' }).expect(403);
    await api().post(`/events/${EVENT}/items`).set(as('member')).send({ kind: 'task', parentId: task, title: 'x' }).expect(409);
    await api().post(`/events/${EVENT}/items`).set(as('member')).send({ kind: 'program', parentId: program, title: 'x' }).expect(400);
  });
  it('담당자는 행사 멤버만 지정할 수 있고 지정하면 알림이 간다', async () => {
    await api().patch(`/items/${task}/assignee`).set(as('member')).send({ assigneeId: U.outsider, expectedVersion: 1 }).expect(409);
    const res = await api().patch(`/items/${task}/assignee`).set(as('member')).send({ assigneeId: U.pm, expectedVersion: 1 }).expect(200);
    expect(res.body).toMatchObject({ assigneeId: U.pm, version: 2 });
    const notices = await api().get('/notifications?unread=true').set(as('pm')).expect(200);
    expect(notices.body[0]).toMatchObject({ kind: 'assigned', itemId: task });
  });
  it('담당자·마감일 변경은 version 충돌을 검사한다', async () => {
    const conflict = await api().patch(`/items/${task}/assignee`).set(as('member')).send({ assigneeId: null, expectedVersion: 1 }).expect(409);
    expect(conflict.body).toMatchObject({ code: 'VERSION_CONFLICT', currentVersion: 2 });
    await api().patch(`/items/${task}/schedule`).set(as('member')).send({ startsOn: '2026-03-14', dueOn: '2026-03-13', expectedVersion: 2 }).expect(400);
    const res = await api().patch(`/items/${task}/schedule`).set(as('member')).send({ startsOn: '2026-03-10', dueOn: '2026-03-13', expectedVersion: 2 }).expect(200);
    expect(res.body).toMatchObject({ startsOn: '2026-03-10', dueOn: '2026-03-13', version: 3 });
  });
  it('제목·설명은 마지막 저장 우선이다', async () => {
    const res = await api().patch(`/items/${subtask}`).set(as('member')).send({ title: '최종 시안' }).expect(200);
    expect(res.body).toMatchObject({ title: '최종 시안', version: 2 });
  });
  it('완료 처리는 담당자만 한다 (담당자 없으면 만든 사람)', async () => {
    await api().patch(`/items/${task}`).set(as('member')).send({ status: '완료' }).expect(403);
    const res = await api().patch(`/items/${task}`).set(as('pm')).send({ status: '완료' }).expect(200);
    expect(res.body.status).toBe('완료');
    expect(res.body.completedAt).toBeTruthy();
    const own = await api().post(`/events/${EVENT}/items`).set(as('member')).send({ kind: 'task', parentId: program, title: '본인 완료' }).expect(201);
    const done = await api().patch(`/items/${own.body.id}`).set(as('member')).send({ status: '완료' }).expect(200);
    expect(done.body.completedAt).toBeTruthy();
  });
  it('Program만 Client에 공개할 수 있다', async () => {
    await api().patch(`/items/${task}/client-visible`).set(as('member')).send({ clientVisible: true, expectedVersion: 4 }).expect(400);
    const res = await api().patch(`/items/${program}/client-visible`).set(as('member')).send({ clientVisible: true, expectedVersion: 1 }).expect(200);
    expect(res.body).toMatchObject({ clientVisible: true, version: 2 });
  });
  it('삭제는 하위 항목까지 함께 적용된다', async () => {
    await api().delete(`/items/${task}`).set(as('member')).expect(200);
    await api().get(`/items/${task}`).set(as('staff')).expect(404);
    await api().get(`/items/${subtask}`).set(as('staff')).expect(404);
  });
  it('목록 조회 필터가 동작한다', async () => {
    const res = await api().get(`/events/${EVENT}/items?kind=program`).set(as('staff')).expect(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('알림 (F-06)', () => {
  it('본인 알림만 보고 읽음 처리할 수 있다', async () => {
    const unread = await api().get('/notifications?unread=true').set(as('pm')).expect(200);
    expect(unread.body.length).toBeGreaterThan(0);
    const res = await api().post('/notifications/read').set(as('pm')).send({ ids: unread.body.map((n: { id: number }) => n.id) }).expect(200);
    expect(res.body.updated).toBe(unread.body.length);
    expect((await api().get('/notifications?unread=true').set(as('pm')).expect(200)).body).toHaveLength(0);
  });
});

describe('Client 포털 (F-07)', () => {
  it('낮은 직원은 포털을 쓸 수 없고 Client는 지정된 행사만 본다', async () => {
    await api().get('/portal/events').set(as('staff')).expect(403);
    const events = await api().get('/portal/events').set(as('client')).expect(200);
    expect(events.body).toEqual([expect.objectContaining({ eventId: EVENT, name: '개막 행사' })]);
  });
  it('공개된 Program 일정만 표시된다', async () => {
    const programs = await api().get('/portal/programs').set(as('client')).expect(200);
    expect(programs.body).toEqual([
      expect.objectContaining({ eventId: EVENT, title: '개막식', startsOn: null, dueOn: null }),
    ]);
  });
  it('PM·AM은 Client를 지정·해제하고 포털에 반영된다', async () => {
    await api().put(`/events/${EVENT}/clients/${U.client2}`).set(as('pm')).expect(200);
    expect((await api().get('/portal/events').set(as('client2')).expect(200)).body).toHaveLength(1);
    await api().delete(`/events/${EVENT}/clients/${U.client2}`).set(as('pm')).expect(200);
    expect((await api().get('/portal/events').set(as('client2')).expect(200)).body).toHaveLength(0);
    expect((await count()) - before).toBe(2); // 앞선 스펙의 지정 기록은 세지 않는다.
  });
});

describe('휴가·연차 (F-12)', () => {
  it('주말 신청과 반차 기간 신청은 거부된다', async () => {
    await api().post('/leave').set(as('member')).send({ kind: 'full', startDate: '2026-10-24', endDate: '2026-10-24' }).expect(400);
    await api().post('/leave').set(as('member')).send({ kind: 'am-half', startDate: '2026-10-19', endDate: '2026-10-20' }).expect(400);
  });
  it('기간 신청은 평일마다 한 건씩 생긴다', async () => {
    const res = await api().post('/leave').set(as('member')).send({ kind: 'full', startDate: '2026-10-19', endDate: '2026-10-21' }).expect(201);
    expect(res.body).toHaveLength(3);
  });
  it('같은 날 같은 형태의 중복 신청은 거부된다', async () => {
    await api().post('/leave').set(as('member')).send({ kind: 'full', startDate: '2026-10-19', endDate: '2026-10-19' }).expect(409);
  });
  it('연차 현황의 used는 대휴를 제외하고 월별 합계를 낸다', async () => {
    await api().post('/leave').set(as('member')).send({ kind: 'am-half', startDate: '2026-10-22', endDate: '2026-10-22' }).expect(201);
    const count = async () => (await admin.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'event.client.change'`)).rows[0]!.n as number;
    const before = await count();
    const res = await api().get('/leave/balances?year=2026').set(as('staff')).expect(200);
    const mine = res.body.find((b: { userId: string }) => b.userId === U.member);
    expect(mine).toMatchObject({ used: 3.5, total: 15 });
    expect(mine.monthly[9]).toBe(3.5);
  });
  it('취소는 soft delete다', async () => {
    const list = await api().get('/leave?year=2026&month=10').set(as('member')).expect(200);
    await api().delete(`/leave/${list.body[0].id}`).set(as('member')).expect(200);
    const mine = (await api().get('/leave/balances?year=2026').set(as('staff')).expect(200)).body.find((b: { userId: string }) => b.userId === U.member);
    expect(mine.used).toBe(2.5);
    await api().delete(`/leave/${list.body[0].id}`).set(as('pm')).expect(404);
  });
  it('대휴는 주말 근무 일수를 넘길 수 없다', async () => {
    await api().put('/leave/weekend-work').set(as('member')).send({ date: '2026-10-24', worked: true }).expect(200);
    const work = await api().get('/leave/weekend-work').set(as('member')).expect(200);
    expect(work.body.dates).toContain('2026-10-24');
    await api().post('/leave').set(as('member')).send({ kind: 'comp', startDate: '2026-10-26', endDate: '2026-10-27' }).expect(409);
    await api().post('/leave').set(as('member')).send({ kind: 'comp', startDate: '2026-10-26', endDate: '2026-10-26' }).expect(201);
    const mine = (await api().get('/leave/balances?year=2026').set(as('staff')).expect(200)).body.find((b: { userId: string }) => b.userId === U.member);
    expect(mine).toMatchObject({ compEarned: 1, compUsed: 1 });
  });
  it('Client는 휴가 내역을 조회할 수 없다', async () => {
    await api().get('/leave?year=2026').set(as('client')).expect(403);
  });
});

describe('행사 문서 열람 범위 (F-09)', () => {
  it('열람 범위에 따라 문서 목록이 필터링된다', async () => {
    const staffDocs = await api().get(`/events/${EVENT}/docs`).set(as('staff')).expect(200);
    expect(staffDocs.body.map((d: { id: string }) => d.id)).toEqual([DOC_ALL]);
    const memberDocs = await api().get(`/events/${EVENT}/docs`).set(as('member')).expect(200);
    expect(memberDocs.body.map((d: { id: string }) => d.id).sort()).toEqual([DOC_ALL, DOC_MEMBERS].sort());
  });
  it('열람 범위 변경은 PM·AM만 하고 version 충돌을 검사한다', async () => {
    await api().patch(`/events/${EVENT}/docs/${DOC_MEMBERS}/visibility`).set(as('member')).send({ visibility: 'all', expectedVersion: 1 }).expect(403);
    const res = await api().patch(`/events/${EVENT}/docs/${DOC_MEMBERS}/visibility`).set(as('pm')).send({ visibility: 'all', expectedVersion: 1 }).expect(200);
    expect(res.body).toMatchObject({ visibility: 'all', version: 2 });
    await api().patch(`/events/${EVENT}/docs/${DOC_MEMBERS}/visibility`).set(as('pm')).send({ visibility: 'members', expectedVersion: 1 }).expect(409);
    expect((await api().get(`/events/${EVENT}/docs`).set(as('staff')).expect(200)).body).toHaveLength(2);
    const log = await admin.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'doc.visibility.change'`);
    expect(log.rows[0].n).toBe(1);
  });
});

describe('서버 오류 응답', () => {
  it('예상 못한 오류는 500에 오류 이름·메시지를 담아 낸다', async () => {
    const res = await api().get('/__test_boom').expect(500);
    expect(res.body.statusCode).toBe(500);
    expect(res.body.message).toContain('[500]');
    expect(res.body.message).toContain('Error: 테스트용 폭발');
  });
  it('HttpException 응답 형태는 그대로다', async () => {
    const res = await api().get(`/events/${id(999)}`).set(as('pm')).expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: '[404] 행사을 찾을 수 없습니다.', error: 'Not Found' });
  });
});
