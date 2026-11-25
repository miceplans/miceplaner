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
const U = { a: id(9201), b: id(9202), client: id(9203) };
let app: INestApplication;
let admin: TestAdmin;
const tokens: Record<string, string> = {};
const sign = (sub: string, role = 'staff') =>
  new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).sign(new TextEncoder().encode(process.env.JWT_SECRET));
const as = (user: keyof typeof U) => ({ Authorization: `Bearer ${tokens[user]}` });
const api = () => request(app.getHttpServer());

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1,'협력가','a@partners.test','staff'), ($2,'협력나','b@partners.test','staff'), ($3,'협력고객','c@partners.test','client')`,
    [U.a, U.b, U.client],
  );
  tokens.a = await sign(U.a);
  tokens.b = await sign(U.b);
  tokens.client = await sign(U.client, 'client');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(HiworksService).useValue({ findMember: async () => undefined }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 120_000);
afterAll(async () => { await app.close(); await admin.end(); });

const body = { name: '가나인쇄', field: '출력·인쇄', manager: '홍', phone: '', email: '', memo: '' };

describe('협력사 API (F-14)', () => {
  it('직원끼리 공유하고 Client와 로그인하지 않은 사용자는 거부한다', async () => {
    const pid = id(9211);
    await api().put(`/partners/${pid}`).set(as('a')).send(body).expect(200);
    await api().put(`/partners/${pid}`).set(as('b')).send({ ...body, phone: '02-1' }).expect(200);
    const list = await api().get('/partners').set(as('a')).expect(200);
    expect(list.body).toMatchObject([{ id: pid, phone: '02-1' }]);
    await api().get('/partners').set(as('client')).expect(403);
    await api().put(`/partners/${pid}`).set(as('client')).send(body).expect(403);
    await api().get('/partners').expect(401);
    await api().put(`/partners/${pid}`).set(as('a')).send({ ...body, name: ' ' }).expect(400);
    await api().delete(`/partners/${pid}`).set(as('b')).expect(200);
    await api().delete(`/partners/${pid}`).set(as('b')).expect(404);
    const revived = await api().put(`/partners/${pid}`).set(as('a')).send(body);
    expect(revived.status).toBeGreaterThanOrEqual(400);
    expect(revived.status).toBeLessThan(500);
  });

  it('같은 이름의 태그는 알아볼 수 있는 409다', async () => {
    const created = await api().post('/partner-fields').set(as('a')).send({ name: '통역' }).expect(201);
    const dup = await api().post('/partner-fields').set(as('b')).send({ name: '통역' }).expect(409);
    expect(dup.body.message).toBe('[409] 같은 이름의 태그가 있습니다.');
    await api().put(`/partner-fields/${created.body.id}`).set(as('b')).send({ name: '통역·번역' }).expect(200);
    await api().post('/partner-fields').set(as('a')).send({ name: '전체' }).expect(400);
    await api().delete(`/partner-fields/${created.body.id}`).set(as('a')).expect(200);
  });
});
