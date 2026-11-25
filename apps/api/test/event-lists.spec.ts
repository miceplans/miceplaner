import 'reflect-metadata';
import { SignJWT } from 'jose';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HiworksService } from '../src/auth/hiworks';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { member: id(9101), staff: id(9102), client: id(9103) };
const CO = id(9111);
const EVENT = id(9121);

let app: INestApplication;
let http: Parameters<typeof request>[0];
let admin: TestAdmin;
const tokens: Record<string, string> = {};

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (sub: string, role = 'staff') => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).sign(secret());
const as = (user: keyof typeof U) => ({ Authorization: `Bearer ${tokens[user]}` });
const api = () => request(http);

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1,'목록멤버','member@lists.test','staff'), ($2,'목록직원','staff@lists.test','staff'), ($3,'목록고객','client@lists.test','client')`,
    [U.member, U.staff, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '목록 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, '목록 행사', '2026-12-01', '2026-12-02')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1, $2, 'member')`, [EVENT, U.member]);
  tokens.member = await sign(U.member);
  tokens.staff = await sign(U.staff);
  tokens.client = await sign(U.client, 'client');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(HiworksService)
    .useValue({ findMember: async () => undefined })
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  http = app.getHttpServer();
}, 120_000);

afterAll(async () => {
  await app.close();
  await admin.end();
});

const product = { name: '배너', part: '디자인', dueOn: null, size: '1x2m', qty: '2', material: '', vendor: '', contact: '', note: '', negotiating: false, status: 'draft' };

describe('행사 상세 목록 API (F-04)', () => {
  it('스케줄·할 일은 웹이 정한 id와 시작·종료 시각으로 만들고, 중복 id는 409다', async () => {
    const pid = id(9131);
    const created = await api().post(`/events/${EVENT}/items`).set(as('member'))
      .send({ id: pid, kind: 'program', title: '리허설', dueOn: '2026-12-01', startMinute: 600, endMinute: 690 }).expect(201);
    expect(created.body).toMatchObject({ id: pid, startMinute: 600, endMinute: 690 });
    await api().post(`/events/${EVENT}/items`).set(as('member')).send({ id: pid, kind: 'program', title: '중복' }).expect(409);
    await api().post(`/events/${EVENT}/items`).set(as('member')).send({ kind: 'program', title: '역순', startMinute: 600, endMinute: 500 }).expect(400);
    const task = await api().post(`/events/${EVENT}/items`).set(as('member')).send({ id: id(9132), kind: 'task', parentId: pid, title: '음향 체크' }).expect(201);
    expect(task.body).toMatchObject({ parentId: pid, startMinute: null });
    const patched = await api().patch(`/items/${pid}`).set(as('member')).send({ startMinute: 540, endMinute: 600 }).expect(200);
    expect(patched.body).toMatchObject({ startMinute: 540, endMinute: 600 });
  });

  it('제작물은 행사 멤버만 저장·삭제하고, 내부 직원은 보며 Client는 403이다', async () => {
    const pid = id(9141);
    await api().put(`/events/${EVENT}/products/${pid}`).set(as('member')).send(product).expect(200);
    const saved = await api().put(`/events/${EVENT}/products/${pid}`).set(as('member')).send({ ...product, status: 'pending' }).expect(200);
    expect(saved.body).toMatchObject({ id: pid, eventId: EVENT, status: 'pending', size: '1x2m' });
    await api().put(`/events/${EVENT}/products/${id(9142)}`).set(as('staff')).send(product).expect(403);
    const seen = await api().get(`/events/${EVENT}/products`).set(as('staff')).expect(200);
    expect(seen.body).toHaveLength(1);
    await api().get(`/events/${EVENT}/products`).set(as('client')).expect(403);
    await api().delete(`/events/${EVENT}/products/${pid}`).set(as('staff')).expect(403);
    await api().delete(`/events/${EVENT}/products/${pid}`).set(as('member')).expect(200);
    expect((await api().get(`/events/${EVENT}/products`).set(as('member')).expect(200)).body).toHaveLength(0);
  });

  it('캘린더 블록은 행사 멤버만 저장하고 시각 순서를 검사한다', async () => {
    const bid = id(9151);
    const block = { title: '리허설', date: '2026-12-01', startMinute: 540, endMinute: 600 };
    await api().put(`/events/${EVENT}/calendar-blocks/${bid}`).set(as('member')).send(block).expect(200);
    await api().put(`/events/${EVENT}/calendar-blocks/${bid}`).set(as('member')).send({ ...block, endMinute: 500 }).expect(400);
    await api().put(`/events/${EVENT}/calendar-blocks/${id(9152)}`).set(as('staff')).send(block).expect(403);
    expect((await api().get(`/events/${EVENT}/calendar-blocks`).set(as('staff')).expect(200)).body).toEqual([expect.objectContaining({ id: bid, ...block })]);
    await api().delete(`/events/${EVENT}/calendar-blocks/${bid}`).set(as('member')).expect(200);
  });
});
