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
let approvedClientUserId = '';

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

  for (const [name, uid] of Object.entries(U)) tokens[name] = await sign(uid, name === 'client' || name === 'client2' ? 'client' : name === 'admin' ? 'super_admin' : 'staff');

  const hiworksMembers = new Map([
    ['new@x.test', { email: 'new@x.test', name: '신규' }],
    ['pm@x.test', { email: 'pm@x.test', name: 'PM' }],
    ['target@x.test', { email: 'target@x.test', name: 'Target', team: '디자인팀', subTeam: '영상팀' }],
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
  it('Client는 회사명으로 신청하고 Super Admin 승인 뒤에만 포털에 로그인한다', async () => {
    const application = await api().post('/auth/client-applications').send({
      companyName: '테스트사', applicantName: '홍길동', email: 'applicant@x.test', password: 'client-long-password',
    }).expect(201);
    expect(application.body).toMatchObject({ companyName: '테스트사', applicantName: '홍길동', status: 'pending' });
    await api().post('/auth/client/login').send({ email: 'applicant@x.test', password: 'client-long-password' }).expect(401);
    const notice = await api().get('/notifications?unread=true').set(as('admin')).expect(200);
    expect(notice.body.find((item: { title: string }) => item.title.includes(application.body.id))).toMatchObject({ actionStatus: 'pending' });
    expect(notice.body).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'client_application', title: expect.stringContaining('테스트사의 홍길동님이 신청하셨습니다.') })]));
    await api().post(`/auth/client-applications/${application.body.id}/approve`).set(as('staff')).expect(403);
    await api().post(`/auth/client-applications/${application.body.id}/approve`).set(as('admin')).expect(200);
    const approvedNotice = await api().get('/notifications').set(as('admin')).expect(200);
    expect(approvedNotice.body.find((item: { title: string }) => item.title.includes(application.body.id))).toMatchObject({ actionStatus: 'approved' });
    expect(approvedNotice.body.find((item: { title: string; readAt: string | null }) => item.title.includes(application.body.id)).readAt).not.toBeNull();
    const login = await api().post('/auth/client/login').send({ email: 'applicant@x.test', password: 'client-long-password' }).expect(200);
    expect(login.body.user).toMatchObject({ name: '홍길동', role: 'client' });
    approvedClientUserId = login.body.user.id;
  });
  it('신청 회사명과 같은 고객사가 있으면 승인 때 연결되어 그 고객사의 행사가 포털에 보인다', async () => {
    const application = await api().post('/auth/client-applications').send({
      companyName: ' 고객사 ', applicantName: '김연결', email: 'linked@x.test', password: 'client-long-password',
    }).expect(201);
    await api().post(`/auth/client-applications/${application.body.id}/approve`).set(as('admin')).expect(200);
    const login = await api().post('/auth/client/login').send({ email: 'linked@x.test', password: 'client-long-password' }).expect(200);
    const portal = await api().get('/portal/events').set({ Authorization: `Bearer ${login.body.accessToken}` }).expect(200);
    expect(portal.body.map((e: { eventId: string }) => e.eventId).sort()).toEqual([EVENT, OTHER_EVENT].sort());
    const accounts = await api().get('/client-accounts').set(as('staff')).expect(200);
    expect(accounts.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: login.body.user.id, clientId: CO, companyName: null })]));
  });
  it('Super Admin만 Client 계정을 고객사에 연결·해제하고 감사 로그를 남긴다', async () => {
    await api().get('/client-accounts').set(as('client')).expect(403);
    await api().put(`/client-accounts/${approvedClientUserId}/client`).set(as('staff')).send({ clientId: CO }).expect(403);
    await api().put(`/client-accounts/${U.staff}/client`).set(as('admin')).send({ clientId: CO }).expect(404);
    const linked = await api().put(`/client-accounts/${approvedClientUserId}/client`).set(as('admin')).send({ clientId: CO }).expect(200);
    expect(linked.body).toMatchObject({ id: approvedClientUserId, clientId: CO, companyName: '테스트사' });
    const unlinked = await api().put(`/client-accounts/${approvedClientUserId}/client`).set(as('admin')).send({ clientId: null }).expect(200);
    expect(unlinked.body).toMatchObject({ clientId: null });
    const audit = await admin.query(`SELECT detail->>'clientId' AS "clientId" FROM audit_log WHERE action = 'client.account.link' AND detail->>'userId' = $1 ORDER BY id`, [approvedClientUserId]);
    expect(audit.rows).toEqual([{ clientId: CO }, { clientId: null }]);
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
  it('Super Admin만 직원 권한과 재직 상태를 바꾸고 변경 즉시 세션에 반영한다', async () => {
    await api().get('/staff-accounts').set(as('staff')).expect(403);
    const list = await api().get('/staff-accounts').set(as('admin')).expect(200);
    expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: U.target, role: 'staff', employmentStatus: 'active' })]));

    await api().patch(`/staff-accounts/${U.target}`).set(as('admin')).send({ role: 'super_admin' }).expect(200)
      .expect(({ body }) => expect(body.role).toBe('super_admin'));
    await api().get('/staff-accounts').set(as('target')).expect(200);

    await api().patch(`/staff-accounts/${U.target}`).set(as('admin')).send({ employmentStatus: 'departed', role: 'staff' }).expect(200);
    await api().get('/auth/me').set(as('target')).expect(401);
    await api().patch(`/staff-accounts/${U.target}`).set(as('admin')).send({ employmentStatus: 'active' }).expect(200);
    await api().get('/auth/me').set(as('target')).expect(200);

    const audit = await admin.query(`SELECT action FROM audit_log WHERE action = 'staff.account.change' AND detail->>'userId' = $1`, [U.target]);
    expect(audit.rows.length).toBeGreaterThanOrEqual(3);
  });
  it('Super Admin만 직원 직급을 입력하고, 목록에 하이웍스 팀을 함께 내려준다', async () => {
    const list = await api().get('/staff-accounts').set(as('admin')).expect(200);
    expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: U.target, team: '디자인팀', subTeam: '영상팀' })]));

    await api().patch(`/staff-accounts/${U.target}`).set(as('staff')).send({ jobTitle: '대리' }).expect(403);
    await api().patch(`/staff-accounts/${U.target}`).set(as('admin')).send({ jobTitle: '  대리 ' }).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ jobTitle: '대리', team: '디자인팀', role: 'staff', employmentStatus: 'active' }));
    await api().patch(`/staff-accounts/${U.target}`).set(as('admin')).send({ jobTitle: 'x'.repeat(51) }).expect(400);
    await api().patch(`/staff-accounts/${U.target}`).set(as('admin')).send({ jobTitle: '' }).expect(200)
      .expect(({ body }) => expect(body.jobTitle).toBe(''));

    const audit = await admin.query(`SELECT detail FROM audit_log WHERE action = 'staff.account.change' AND detail->>'userId' = $1 AND detail->>'jobTitle' = '대리'`, [U.target]);
    expect(audit.rows).toHaveLength(1);
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
  it('행사 상태는 PM·AM만 바꾸고 일반 멤버는 403이다', async () => {
    await api().patch(`/events/${EVENT}`).set(as('member')).send({ status: '성공' }).expect(403);
    const res = await api().patch(`/events/${EVENT}`).set(as('pm')).send({ status: '확인중' }).expect(200);
    expect(res.body.status).toBe('확인중');
    // 같은 값을 함께 보내는 일반 수정은 막지 않는다.
    await api().patch(`/events/${EVENT}`).set(as('member')).send({ status: '확인중', place: '코엑스' }).expect(200);
    await api().patch(`/events/${EVENT}`).set(as('pm')).send({ status: '진행중' }).expect(200);
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
  it('Staff는 행사를 만들고 자동으로 PM이 된다', async () => {
    const res = await api().post('/events').set(as('staff')).send({
      clientId: CO,
      name: '신규 행사',
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      place: '코엑스',
    }).expect(201);
    expect(res.body).toMatchObject({ name: '신규 행사', clientId: CO, status: '진행중' });
    expect((await api().get(`/events/${res.body.id}/members`).set(as('staff')).expect(200)).body).toEqual([
      { eventId: res.body.id, userId: U.staff, role: 'pm' },
    ]);
    expect((await admin.query(`SELECT action FROM audit_log WHERE event_id = $1`, [res.body.id])).rows).toContainEqual({ action: 'event.create' });
  });
  it('Client는 행사를 만들 수 없다', async () => {
    await api().post('/events').set(as('client')).send({ clientId: CO, name: 'x', startDate: '2026-09-10', endDate: '2026-09-12' }).expect(403);
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
  it('PM은 기존 행사 멤버에게 역할을 넘기고 본인은 일반 멤버가 된다', async () => {
    const created = await api().post('/events').set(as('staff')).send({ clientId: CO, name: '인수인계 행사', startDate: '2026-10-01', endDate: '2026-10-02' }).expect(201);
    await api().post(`/events/${created.body.id}/members`).set(as('staff')).send({ userId: U.target, role: 'am' }).expect(201);
    await api().post(`/events/${created.body.id}/transfer-pm`).set(as('staff')).send({ userId: U.target }).expect(201);
    expect((await api().get(`/events/${created.body.id}/members`).set(as('staff')).expect(200)).body).toEqual([
      { eventId: created.body.id, userId: U.staff, role: 'member' },
      { eventId: created.body.id, userId: U.target, role: 'pm' },
    ]);
    await api().post(`/events/${created.body.id}/transfer-pm`).set(as('staff')).send({ userId: U.target }).expect(403);
    expect((await admin.query(`SELECT action FROM audit_log WHERE event_id = $1`, [created.body.id])).rows).toContainEqual({ action: 'member.pm.transfer' });
  });
  it('PM 넘기기는 양쪽에 pm_transferred 알림이 간다 (추가 알림이 아니다)', async () => {
    const created = await api().post('/events').set(as('staff')).send({ clientId: CO, name: '알림 행사', startDate: '2026-10-05', endDate: '2026-10-06' }).expect(201);
    await api().post(`/events/${created.body.id}/members`).set(as('staff')).send({ userId: U.target }).expect(201);
    await api().post(`/events/${created.body.id}/transfer-pm`).set(as('staff')).send({ userId: U.target }).expect(201);
    const received = (await api().get('/notifications').set(as('target')).expect(200)).body as { kind: string; title: string }[];
    const given = (await api().get('/notifications').set(as('staff')).expect(200)).body as { kind: string; title: string }[];
    expect(received.find((n) => n.kind === 'pm_transferred')?.title).toContain('넘겨받았습니다');
    expect(given.find((n) => n.kind === 'pm_transferred')?.title).toContain('넘겼습니다');
  });
  it('Super Admin이 만든 행사는 Super Admin이 PM을 넘길 수 있다', async () => {
    const created = await api().post('/events').set(as('admin')).send({ clientId: CO, name: '관리자 행사', startDate: '2026-10-07', endDate: '2026-10-08' }).expect(201);
    expect(created.body).toMatchObject({ pmName: 'Admin', clientName: '고객사' });
    await api().post(`/events/${created.body.id}/members`).set(as('admin')).send({ userId: U.target }).expect(201);
    await api().post(`/events/${created.body.id}/transfer-pm`).set(as('admin')).send({ userId: U.target }).expect(201);
    expect((await api().get(`/events/${created.body.id}/members`).set(as('admin')).expect(200)).body).toEqual([
      { eventId: created.body.id, userId: U.admin, role: 'member' },
      { eventId: created.body.id, userId: U.target, role: 'pm' },
    ]);
  });
});

describe('Client 지정 무결성 (F-07)', () => {
  it('내부 직원은 Client로 지정할 수 없고, Client 역할 사용자만 지정한다', async () => {
    await api().put(`/events/${EVENT}/clients/${U.staff}`).set(as('pm')).expect(400);
    await api().put(`/events/${EVENT}/clients/${approvedClientUserId}`).set(as('pm')).expect(200);
    expect((await api().get(`/events/${EVENT}/clients`).set(as('pm')).expect(200)).body).toContain(approvedClientUserId);
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
  it('알림함은 공개 Program의 공개·일정 변경만 보여 주고 읽음은 본인 것만 바꾼다', async () => {
    await api().get('/portal/notifications').set(as('staff')).expect(403);
    await api().post('/portal/notifications/read').set(as('staff')).send({ ids: [1] }).expect(403);
    await api().get('/portal/notifications').expect(401);
    const { body: programs } = await api().get('/portal/programs').set(as('client')).expect(200);
    const programId = programs[0].programId as string;
    const list = async (who: 'client' | 'client2') => (await api().get('/portal/notifications').set(as(who)).expect(200)).body as { id: number; kind: string; programId: string; readAt: string | null }[];
    const before = (await list('client')).length;

    const { version } = (await api().get(`/items/${programId}`).set(as('pm')).expect(200)).body as { version: number };
    const moved = await api().patch(`/items/${programId}/schedule`).set(as('pm')).send({ startsOn: '2026-12-01', dueOn: '2026-12-02', expectedVersion: version }).expect(200);
    const after = await list('client');
    expect(after).toHaveLength(before + 1);
    expect(after[0]).toMatchObject({ kind: 'schedule_changed', programId, programTitle: '개막식', beforeDueOn: null, afterDueOn: '2026-12-02', readAt: null });
    expect(Object.keys(after[0]!).sort()).toEqual(['afterDueOn', 'afterStartsOn', 'beforeDueOn', 'beforeStartsOn', 'createdAt', 'eventId', 'eventName', 'id', 'kind', 'programId', 'programTitle', 'readAt']);
    expect(await list('client2')).toEqual([]);

    await api().post('/portal/notifications/read').set(as('client')).send({ ids: [] }).expect(400);
    const foreign = await api().post('/portal/notifications/read').set(as('client2')).send({ ids: [after[0]!.id] }).expect(200);
    expect(foreign.body).toEqual({ updated: 0 });
    const read = await api().post('/portal/notifications/read').set(as('client')).send({ ids: [after[0]!.id] }).expect(200);
    expect(read.body).toEqual({ updated: 1 });
    expect((await list('client'))[0]!.readAt).not.toBeNull();

    await api().patch(`/items/${programId}/schedule`).set(as('pm')).send({ startsOn: null, dueOn: null, expectedVersion: moved.body.version }).expect(200);
  });
  it('PM·AM은 Client를 지정·해제하고 포털에 반영된다', async () => {
    const count = async () => (await admin.query(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'event.client.change'`)).rows[0]!.n as number;
    const before = await count();
    await api().put(`/events/${EVENT}/clients/${U.client2}`).set(as('pm')).expect(200);
    expect((await api().get('/portal/events').set(as('client2')).expect(200)).body).toHaveLength(1);
    await api().delete(`/events/${EVENT}/clients/${U.client2}`).set(as('pm')).expect(200);
    expect((await api().get('/portal/events').set(as('client2')).expect(200)).body).toHaveLength(0);
    expect((await count()) - before).toBe(2); // 앞선 스펙의 지정 기록은 세지 않는다.
  });
  it('비로그인 공개 캘린더는 PM·AM이 공개 표시한 행사의 행사명·기간만 보여 준다', async () => {
    const mine = (body: { eventId: string }[]) => body.filter((e) => e.eventId === EVENT || e.eventId === OTHER_EVENT);
    expect(mine((await api().get('/portal/public-events').expect(200)).body)).toEqual([]);

    const { version } = (await api().get(`/events/${EVENT}`).set(as('pm')).expect(200)).body as { version: number };
    await api().put(`/events/${EVENT}/public-visibility`).set(as('member')).send({ publicVisible: true, version }).expect(403);
    await api().put(`/events/${EVENT}/public-visibility`).set(as('client')).send({ publicVisible: true, version }).expect(403);
    const updated = await api().put(`/events/${EVENT}/public-visibility`).set(as('pm')).send({ publicVisible: true, version }).expect(200);
    expect(updated.body).toMatchObject({ publicVisible: true, version: version + 1 });

    // 이전 version으로 다시 바꾸려 하면 충돌이다.
    const conflict = await api().put(`/events/${EVENT}/public-visibility`).set(as('pm')).send({ publicVisible: false, version }).expect(409);
    expect(conflict.body).toMatchObject({ code: 'VERSION_CONFLICT', currentVersion: version + 1 });

    const open = (await api().get('/portal/public-events').expect(200)).body as Record<string, unknown>[];
    expect(mine(open as { eventId: string }[])).toEqual([{ eventId: EVENT, name: '개막 행사', startDate: expect.any(String), endDate: expect.any(String), color: expect.toBeOneOf([expect.any(String), null]) }]);
    expect(Object.keys(open[0]!).sort()).toEqual(['color', 'endDate', 'eventId', 'name', 'startDate']);
    const log = await admin.query(`SELECT actor_id FROM audit_log WHERE action = 'event.public_visibility.change' AND event_id = $1`, [EVENT]);
    expect(log.rows).toEqual([{ actor_id: U.pm }]);

    await api().put(`/events/${EVENT}/public-visibility`).set(as('pm')).send({ publicVisible: false, version: version + 1 }).expect(200);
    expect(mine((await api().get('/portal/public-events').expect(200)).body)).toEqual([]);
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
    const half = await api().post('/leave').set(as('member')).send({ kind: 'am-half', startDate: '2026-10-22', endDate: '2026-10-22', reason: ' 병원 ', substituteId: U.pm }).expect(201);
    expect(half.body[0]).toMatchObject({ reason: '병원', substituteId: U.pm });
    const seen = (await api().get('/leave?year=2026&month=10').set(as('staff')).expect(200)).body.find((r: { id: string }) => r.id === half.body[0].id);
    expect(seen).toMatchObject({ reason: '병원', substituteId: U.pm });
    await api().post('/leave').set(as('member')).send({ kind: 'pm-half', startDate: '2026-10-22', endDate: '2026-10-22', substituteId: U.member }).expect(409);
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
  it('예상 못한 오류는 500에 일반 메시지와 요청 ID만 담고 내부 내용은 숨긴다', async () => {
    const res = await api().get('/__test_boom').set('x-request-id', 'req-123').expect(500);
    expect(res.body).toEqual({ statusCode: 500, message: '[500] 서버 오류가 발생했습니다.', requestId: 'req-123' });
    expect(JSON.stringify(res.body)).not.toContain('테스트용 폭발');
    expect(res.headers['x-request-id']).toBe('req-123');
  });
  it('HttpException 응답 형태는 그대로다', async () => {
    const res = await api().get(`/events/${id(999)}`).set(as('pm')).expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: '[404] 행사을 찾을 수 없습니다.', error: 'Not Found' });
  });
});
