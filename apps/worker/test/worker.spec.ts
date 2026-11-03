import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, getDocPage, getFile, hasVector, insertFile, searchChunksDense, searchChunksFts, withContext, type DbContext, type Pool } from '@miceplans/db';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import { openProducer, runWorker, type Producer } from '@miceplans/queue';
import { EMBEDDING_DIM, type Embedder } from '@miceplans/knowledge/embed';
import { fsStore, type ObjectStore } from '@miceplans/storage';
import { embedDocHandler, parseFileHandler } from '../src/handlers';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PM = id(3011);
const EVENT = id(3101);
const CO = id(3201);
const ctx: DbContext = { workspaceId: 'w1', userId: PM, role: 'member' };

let admin: TestAdmin;
let app: Pool;
let dir: string;
let store: ObjectStore;
let producer: Producer;
let stopWorker: () => Promise<void>;
let vector = false;

/** 문장에 '케이터링'이 있으면 축 0, 아니면 축 1을 가리키는 결정적 가짜 임베딩. */
const fakeEmbedder: Embedder = async (texts) => texts.map((t) => Array.from({ length: EMBEDDING_DIM }, (_, k) => (k === (t.includes('케이터링') ? 0 : 1) ? 1 : 0)));
const embedCalls: number[] = [];

const upload = async (name: string, content: string) => {
  const key = `events/${EVENT}/${name}-${Math.random().toString(36).slice(2)}`;
  const bytes = new TextEncoder().encode(content);
  await store.put(key, bytes, 'text/plain');
  const file = await withContext(app, ctx, (db) => insertFile(db, { eventId: EVENT, name, mime: 'text/plain', sizeBytes: bytes.length, storageKey: key, uploadedBy: PM }));
  await producer.enqueueParseFile({ fileId: file.id, ctx });
  return file.id;
};
const status = (fileId: string) => withContext(app, ctx, (db) => getFile(db, fileId));

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  await admin.query(`INSERT INTO users (id, name, email) VALUES ($1, 'pm', 'w-pm@x.test')`, [PM]);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '워커 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'w-event', '2026-03-13', '2026-03-16')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm')`, [EVENT, PM]);
  app = createPool(process.env.DATABASE_URL!);
  vector = await withContext(app, ctx, (db) => hasVector(db));
  dir = mkdtempSync(join(tmpdir(), 'miceplans-worker-'));
  store = fsStore(dir);
  producer = await openProducer(process.env.DATABASE_URL!);
  const embedder: Embedder = async (t) => { embedCalls.push(t.length); return fakeEmbedder(t); };
  const deps = { pool: app, store, embedder: vector ? embedder : null, enqueueEmbed: producer.enqueueEmbedDoc };
  stopWorker = (await runWorker(process.env.DATABASE_URL!, { parseFile: parseFileHandler(deps), embedDoc: embedDocHandler(deps) })).stop;
});
afterAll(async () => {
  await stopWorker();
  await producer.stop();
  await app.end();
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
});

describe('파일 변환 worker', () => {
  it('업로드 파일이 변환 문서가 되고 한국어 검색에 잡히며 출처가 된다', async () => {
    const fileId = await upload('케이터링-견적.txt', '# 견적\n\n케이터링 업체는 3월 첫째 주에 확정한다.\n');
    await expect.poll(async () => (await status(fileId))?.status, { timeout: 15_000, interval: 200 }).toBe('ready');
    const file = (await status(fileId))!;
    expect(file.docId).not.toBeNull();
    const page = await withContext(app, ctx, (db) => getDocPage(db, file.docId!));
    expect(page).toMatchObject({ title: '케이터링-견적.txt', visibility: 'members' });
    expect(page!.bodyMd).toContain('케이터링 업체는');
    const hits = await withContext(app, ctx, (db) => searchChunksFts(db, "'케이터링':*", { limit: 5 }));
    expect(hits.map((h) => h.docId)).toContain(file.docId);
  });

  it('지원하지 않는 형식은 재시도 없이 사유와 함께 failed가 된다', async () => {
    const fileId = await upload('악성.exe', 'MZ');
    await expect.poll(async () => (await status(fileId))?.status, { timeout: 15_000, interval: 200 }).toBe('failed');
    expect((await status(fileId))!.error).toContain('지원하지 않는');
  });

  it('원본이 저장소에 없으면 failed다', async () => {
    const file = await withContext(app, ctx, (db) => insertFile(db, { eventId: EVENT, name: '유령.txt', mime: 'text/plain', sizeBytes: 1, storageKey: 'events/none', uploadedBy: PM }));
    await producer.enqueueParseFile({ fileId: file.id, ctx });
    await expect.poll(async () => (await status(file.id))?.status, { timeout: 15_000, interval: 200 }).toBe('failed');
  });

  it('보이지 않는 파일(다른 주체)의 작업은 아무것도 바꾸지 않는다', async () => {
    const fileId = await upload('남의파일.txt', '내용 있음');
    await expect.poll(async () => (await status(fileId))?.status, { timeout: 15_000, interval: 200 }).toBe('ready');
    const before = (await admin.query('SELECT count(*)::int AS n FROM event_docs')).rows[0]!.n;
    await producer.enqueueParseFile({ fileId, ctx: { ...ctx, userId: id(3999), role: 'client' } });
    await new Promise((r) => setTimeout(r, 1500));
    expect((await admin.query('SELECT count(*)::int AS n FROM event_docs')).rows[0]!.n).toBe(before);
  });
});

describe.skipIf(!process.env.TEST_PG_EXTERNAL_URL)('임베딩 worker (pgvector 서버 필요)', () => {
  it('변환된 문서의 청크가 임베딩되고 dense 검색으로 찾힌다', async () => {
    expect(vector).toBe(true);
    const fileId = await upload('dense.txt', '케이터링 업체 선정 기준과 예산 한도를 정리한다.');
    await expect.poll(async () => (await status(fileId))?.status, { timeout: 15_000, interval: 200 }).toBe('ready');
    const docId = (await status(fileId))!.docId!;
    await expect.poll(async () => (await admin.query('SELECT count(*)::int AS n FROM knowledge_chunks WHERE doc_id = $1 AND embedding IS NOT NULL', [docId])).rows[0]!.n, { timeout: 15_000, interval: 200 }).toBeGreaterThan(0);
    const query = `[${Array.from({ length: EMBEDDING_DIM }, (_, k) => (k === 0 ? 1 : 0)).join(',')}]`;
    const hits = await withContext(app, ctx, (db) => searchChunksDense(db, query, { limit: 3 }));
    expect(hits.map((h) => h.docId)).toContain(docId); // 같은 축의 다른 문서와 동률일 수 있다
    expect(embedCalls.length).toBeGreaterThan(0);
  });
});
