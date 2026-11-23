import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HiworksService } from '../src/auth/hiworks';

let app: INestApplication;
let admin: TestAdmin;
const api = () => request(app.getHttpServer());
const saved = { ...process.env };
let run = 0;
const ip = () => `203.0.113.${(run += 1)}`;
const login = (email: string, address: string) => api().post('/auth/login').set('x-real-ip', address).send({ email, password: 'wrong-password' });

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(HiworksService)
    .useValue({ findMember: async () => undefined })
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 120_000);

beforeEach(() => {
  process.env.RATE_LIMIT_DISABLED = 'false';
  process.env.AUTH_RATE_LIMIT_IP = '4';
  process.env.AUTH_RATE_LIMIT_EMAIL = '2';
  process.env.CLIENT_APPLICATION_RATE_LIMIT_IP = '2';
});

afterAll(async () => {
  Object.assign(process.env, { RATE_LIMIT_DISABLED: saved.RATE_LIMIT_DISABLED, AUTH_RATE_LIMIT_IP: saved.AUTH_RATE_LIMIT_IP, AUTH_RATE_LIMIT_EMAIL: saved.AUTH_RATE_LIMIT_EMAIL });
  await app.close();
  await admin.end();
});

describe('공개 인증 엔드포인트 요청 제한', () => {
  it('같은 이메일은 한도를 넘으면 429이고 다른 이메일은 영향받지 않는다', async () => {
    const address = ip();
    await login('limit-a@x.test', address).expect(401);
    await login('limit-a@x.test', address).expect(401);
    const blocked = await login('limit-a@x.test', address).expect(429);
    expect(blocked.body).toEqual({ statusCode: 429, message: '[429] 요청이 너무 많습니다. 잠시 후 다시 시도하세요.' });
    await login('limit-b@x.test', address).expect(401);
  });

  it('같은 IP는 이메일을 바꿔도 한도를 넘으면 429이다', async () => {
    const address = ip();
    for (const n of [1, 2, 3, 4]) await login(`ip-${n}@x.test`, address).expect(401);
    await login('ip-5@x.test', address).expect(429);
    await login('ip-6@x.test', ip()).expect(401);
  });

  it('이메일은 대소문자·공백이 달라도 같은 키로 센다', async () => {
    const address = ip();
    await login('Case@x.test', address).expect(401);
    await login(' case@X.test ', address).expect(401);
    await login('CASE@x.test', address).expect(429);
  });

  it('x-forwarded-for를 바꿔도 우회하지 못한다', async () => {
    const address = ip();
    for (let n = 0; n < 2; n += 1) await api().post('/auth/login').set('x-real-ip', address).set('x-forwarded-for', `9.9.9.${n}`).send({ email: 'spoof@x.test', password: 'wrong-password' }).expect(401);
    await api().post('/auth/login').set('x-real-ip', address).set('x-forwarded-for', '9.9.9.99').send({ email: 'spoof@x.test', password: 'wrong-password' }).expect(429);
  });

  it('Client 신청과 가입에도 제한이 걸린다', async () => {
    const address = ip();
    const apply = (n: number) => api().post('/auth/client-applications').set('x-real-ip', address).send({ companyName: '회사', applicantName: '이름', email: `rl-apply-${n}@x.test`, password: 'password-1234' });
    await apply(1).expect(201);
    await apply(2).expect(201);
    await apply(3).expect(429);
    const reg = ip();
    for (let attempt = 0; attempt < 2; attempt += 1) await api().post('/auth/register').set('x-real-ip', reg).send({ email: 'reg@x.test', name: '가입', password: 'password-1234' }).expect(403);
    await api().post('/auth/register').set('x-real-ip', reg).send({ email: 'reg@x.test', name: '가입', password: 'password-1234' }).expect(429);
  });

  it('한도를 끄면 제한하지 않는다', async () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    const address = ip();
    for (let n = 0; n < 6; n += 1) await login('off@x.test', address).expect(401);
  });
});
