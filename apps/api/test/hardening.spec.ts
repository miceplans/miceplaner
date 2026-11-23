import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { LlmChunk, LlmClient } from '@miceplans/ai';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { createApiApp } from '../src/server';
import { LLM_CLIENT } from '../src/tokens';

const USER = '00000000-0000-4000-8000-00000000e501';
const OTHER = '00000000-0000-4000-8000-00000000e502';
const saved = { ...process.env };
let admin: TestAdmin;
const tokens: Record<string, string> = {};
const sign = (sub: string) => new SignJWT({ role: 'staff' }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).sign(new TextEncoder().encode(process.env.JWT_SECRET));

/** 요청마다 동작을 바꾸는 가짜 모델. */
let behave: (signal?: AbortSignal) => AsyncIterable<LlmChunk> = async function* () {
  yield { type: 'text', delta: '기본 답변' };
};
const fakeLlm: LlmClient = { model: 'fake-deadline', stream: ({ signal }) => behave(signal) };

const openApp = async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(LLM_CLIENT).useValue(fakeLlm).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
};

const chat = async (app: INestApplication, user: string) => {
  const res = await request(app.getHttpServer()).post('/ai/chat').set('Authorization', `Bearer ${tokens[user]}`).send({ messages: [{ role: 'user', content: '질문' }] })
    .buffer(true).parse((r, cb) => { let d = ''; r.setEncoding('utf8'); r.on('data', (c) => (d += c)); r.on('end', () => cb(null, d)); });
  const isSse = String(res.headers['content-type']).startsWith('text/event-stream');
  const events = isSse ? (res.body as string).split('\n\n').filter(Boolean).map((b) => JSON.parse(b.split('\n').find((l) => l.startsWith('data: '))!.slice(6))) : [];
  return { status: res.status, events };
};

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  for (const [n, id] of [USER, OTHER].entries()) {
    await admin.query(`INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, 'staff')`, [id, `보안테스트${n}`, `hardening-${n}@x.test`]);
    tokens[id] = await sign(id);
  }
});

afterEach(() => {
  for (const key of ['ENABLE_API_DOCS', 'VERCEL', 'AI_CHAT_DEADLINE_MS', 'AI_REQUESTS_PER_MINUTE']) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

afterAll(async () => {
  await admin.query(`DELETE FROM ai_calls WHERE user_id = ANY($1)`, [[USER, OTHER]]);
  await admin.query(`DELETE FROM users WHERE id = ANY($1)`, [[USER, OTHER]]);
  await admin.end();
});

describe('API 문서 노출', () => {
  const docsStatus = async () => {
    const app = await createApiApp();
    try {
      return [(await request(app.getHttpServer()).get('/docs-json')).status, (await request(app.getHttpServer()).get('/docs')).status];
    } finally {
      await app.close();
    }
  };

  it('운영(Vercel)에서는 /docs와 /docs-json을 열지 않는다', async () => {
    process.env.VERCEL = '1';
    expect(await docsStatus()).toEqual([404, 404]);
  });

  it('ENABLE_API_DOCS=true면 운영에서도 연다', async () => {
    process.env.VERCEL = '1';
    process.env.ENABLE_API_DOCS = 'true';
    expect((await docsStatus())[0]).toBe(200);
  });

  it('개발·테스트에서는 기본으로 열고 ENABLE_API_DOCS=false로 끌 수 있다', async () => {
    expect((await docsStatus())[0]).toBe(200);
    process.env.ENABLE_API_DOCS = 'false';
    expect((await docsStatus())[0]).toBe(404);
  });
});

describe('AI 질의 마감 (AI_CHAT_DEADLINE_MS)', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await openApp(); });
  afterAll(() => app.close());

  it('마감을 넘기면 LLM 호출을 signal로 끊고 error 이벤트로 끝낸다', async () => {
    process.env.AI_CHAT_DEADLINE_MS = '300';
    let aborted = false;
    behave = async function* (signal) {
      yield { type: 'text', delta: '부분 답변' };
      await new Promise<void>((resolve) => signal?.addEventListener('abort', () => { aborted = true; resolve(); }, { once: true }));
      signal?.throwIfAborted();
    };
    const { status, events } = await chat(app, USER);
    expect(status).toBe(200);
    expect(events[0]).toEqual({ type: 'text', delta: '부분 답변' });
    expect(events.at(-1)).toEqual({ type: 'error', message: '[504] 답변 시간이 너무 길어 중단했습니다. 질문을 좁혀 다시 시도해 주세요.' });
    expect(events.some((e) => e.type === 'done')).toBe(false);
    expect(aborted).toBe(true);
    const { rows } = await admin.query(`SELECT error FROM ai_calls WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [USER]);
    expect(String(rows[0]?.error)).toMatch(/마감 초과/);
  });

  it('LLM이 signal을 무시해도 마감에 응답을 끝낸다', async () => {
    process.env.AI_CHAT_DEADLINE_MS = '300';
    behave = async function* () {
      await new Promise(() => {});
      yield { type: 'text', delta: '도달하지 않음' };
    };
    const started = Date.now();
    const { events } = await chat(app, USER);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(events).toEqual([{ type: 'error', message: '[504] 답변 시간이 너무 길어 중단했습니다. 질문을 좁혀 다시 시도해 주세요.' }]);
  });
});

describe('AI 질의 한도는 서버리스 인스턴스 사이에서 공유된다', () => {
  it('두 앱 인스턴스에 나눠 보내도 사용자당 분당 한도를 넘으면 429다', async () => {
    process.env.AI_REQUESTS_PER_MINUTE = '2';
    behave = async function* () { yield { type: 'text', delta: '답' }; };
    const [a, b] = [await openApp(), await openApp()];
    try {
      expect((await chat(a, OTHER)).status).toBe(200);
      expect((await chat(b, OTHER)).status).toBe(200);
      const blocked = await request(a.getHttpServer()).post('/ai/chat').set('Authorization', `Bearer ${tokens[OTHER]}`).send({ messages: [{ role: 'user', content: '질문' }] });
      expect(blocked.status).toBe(429);
      expect(blocked.body.message).toBe('[429] AI 질의가 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      await a.close();
      await b.close();
    }
  });
});
