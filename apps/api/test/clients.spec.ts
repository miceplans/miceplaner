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
const U = { staff: id(81), client: id(82) };

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
    `INSERT INTO users (id, name, email, role) VALUES ($1,'직원','staff@clients.test','staff'), ($2,'고객','client@clients.test','client')`,
    [U.staff, U.client],
  );
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
  await admin.query(`DELETE FROM clients WHERE name LIKE '고객사 생성 테스트%'; DELETE FROM users WHERE id IN ('${U.staff}', '${U.client}')`);
  await app.close();
  await admin.end();
});

describe('고객사 생성', () => {
  it('이름으로 만들고 목록에 나타난다', async () => {
    const res = await api().post('/clients').set(as('staff')).send({ name: '고객사 생성 테스트 A' }).expect(201);
    expect(res.body).toMatchObject({ name: '고객사 생성 테스트 A' });
    expect(res.body.id).toBeTruthy();
    const list = await api().get('/clients').set(as('staff')).expect(200);
    expect(list.body.map((c: { id: string }) => c.id)).toContain(res.body.id);
  });

  it('빈 이름은 거절하고 Client 주처이면 막는다', async () => {
    await api().post('/clients').set(as('staff')).send({ name: '  ' }).expect(400);
    await api().post('/clients').set(as('client')).send({ name: '고객사 생성 테스트 B' }).expect(403);
  });
});
