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
const U = { creator: id(71), pm: id(72), am: id(73), client: id(74) };
const CO = id(221);

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
    `INSERT INTO users (id, name, email, role) VALUES ($1,'작성자','creator@create.test','staff'), ($2,'PM','pm@create.test','staff'), ($3,'AM','am@create.test','staff'), ($4,'Client','client@create.test','client')`,
    [U.creator, U.pm, U.am, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '생성고객')`, [CO]);
  tokens.creator = await sign(U.creator);
  tokens.pm = await sign(U.pm);
  tokens.client = await sign(U.client, 'client');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(HiworksService)
    .useValue({ findMember: async () => undefined })
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  http = app.getHttpServer();
}, 120_000);

afterAll(async () => { await app.close(); await admin.end(); });

describe('행사 생성', () => {
  const base = { name: '신규 행사', clientId: CO, startDate: '2026-03-01', endDate: '2026-03-03', place: '코엑스' };

  it('고객사·PM·AM·예산을 받아 만들고 역할을 맞춘다', async () => {
    const res = await api().post('/events').set(as('creator')).send({ ...base, pmId: U.pm, amId: U.am, budget: 12_500_000 }).expect(201);
    expect(res.body).toMatchObject({ name: '신규 행사', clientId: CO, budget: 12_500_000 });
    const members = await api().get(`/events/${res.body.id}/members`).set(as('creator')).expect(200);
    const roles = Object.fromEntries(members.body.map((m: { userId: string; role: string }) => [m.userId, m.role]));
    expect(roles).toEqual({ [U.pm]: 'pm', [U.am]: 'am', [U.creator]: 'member' });
  });

  it('작성자가 PM이면 그대로 PM이고 예산은 비울 수 있다', async () => {
    const res = await api().post('/events').set(as('creator')).send({ ...base, pmId: U.creator }).expect(201);
    expect(res.body.budget).toBeNull();
    const members = await api().get(`/events/${res.body.id}/members`).set(as('creator')).expect(200);
    expect(members.body).toEqual([{ eventId: res.body.id, userId: U.creator, role: 'pm' }]);
  });

  it('예산을 수정할 수 있다', async () => {
    const res = await api().post('/events').set(as('creator')).send({ ...base, pmId: U.creator, budget: 1000 }).expect(201);
    const patched = await api().patch(`/events/${res.body.id}`).set(as('creator')).send({ budget: 2000 }).expect(200);
    expect(patched.body.budget).toBe(2000);
  });

  it('잘못된 입력과 Client 주체는 거절한다', async () => {
    await api().post('/events').set(as('creator')).send({ ...base, pmId: U.pm, amId: U.pm }).expect(400);
    await api().post('/events').set(as('creator')).send({ ...base, pmId: U.pm, budget: -1 }).expect(400);
    await api().post('/events').set(as('creator')).send({ ...base, endDate: '2026-02-01', pmId: U.pm }).expect(400);
    await api().post('/events').set(as('creator')).send({ ...base, pmId: id(999) }).expect(400);
    await api().post('/events').set(as('client')).send({ ...base, pmId: U.pm }).expect(403);
  });
});
