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
const U = { staff: id(91), other: id(92), client: id(93) };
const KEY = 'day:2026-11-10:api-test';

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
    `INSERT INTO users (id, name, email, role) VALUES ($1,'메모직원','staff@notes.test','staff'), ($2,'다른직원','other@notes.test','staff'), ($3,'메모고객','client@notes.test','client')`,
    [U.staff, U.other, U.client],
  );
  tokens.staff = await sign(U.staff);
  tokens.other = await sign(U.other);
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

describe('일정 상세 메모 API (F-04)', () => {
  it('저장 전에는 빈 내용과 version 0을 돌려준다', async () => {
    const res = await api().get('/schedule-notes').query({ key: KEY }).set(as('staff')).expect(200);
    expect(res.body).toEqual({ key: KEY, eventId: null, content: { assignees: [], description: '', clientMemo: '', tasks: [], links: [] }, version: 0, updatedAt: null });
  });

  it('저장한 내용을 다른 직원도 보고, 담당자 변경은 version이 다르면 409다', async () => {
    await api().put('/schedule-notes').set(as('staff')).send({ key: KEY, baseVersion: 0, patch: { description: '리허설 준비' } }).expect(200);
    const saved = await api().put('/schedule-notes').set(as('staff')).send({ key: KEY, baseVersion: 1, patch: { assignees: ['메모직원'] } }).expect(200);
    expect(saved.body).toMatchObject({ version: 2, content: { description: '리허설 준비', assignees: ['메모직원'] } });

    const seen = await api().get('/schedule-notes').query({ key: KEY }).set(as('other')).expect(200);
    expect(seen.body).toMatchObject({ version: 2, content: { description: '리허설 준비', assignees: ['메모직원'] } });

    const conflict = await api().put('/schedule-notes').set(as('other')).send({ key: KEY, baseVersion: 1, patch: { assignees: [] } }).expect(409);
    expect(conflict.body).toMatchObject({ code: 'VERSION_CONFLICT', currentVersion: 2 });
  });

  it('http(s)가 아닌 링크는 400이다', async () => {
    await api().put('/schedule-notes').set(as('staff'))
      .send({ key: KEY, baseVersion: 2, patch: { links: [{ id: 'l1', name: 'x', url: 'javascript:alert(1)' }] } })
      .expect(400);
  });

  it('Client는 접근할 수 없다', async () => {
    await api().get('/schedule-notes').query({ key: KEY }).set(as('client')).expect(403);
    await api().put('/schedule-notes').set(as('client')).send({ key: KEY, baseVersion: 0, patch: { description: 'x' } }).expect(403);
  });
});
