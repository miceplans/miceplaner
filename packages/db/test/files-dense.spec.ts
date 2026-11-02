import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  chunksMissingEmbedding, createDocPage, getFile, hasVector, insertFile, listFiles, markFile, replaceChunks, searchChunksDense, setChunkEmbeddings, softDeleteFile, withContext, type DbContext,
} from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(2011), member: id(2012), staff: id(2013), client: id(2014) };
const EVENT = id(2101);
const CO = id(2201);
const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { pm: ctx(U.pm, 'member'), member: ctx(U.member, 'member'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client') };

let app: pg.Pool;
let admin: pg.Pool;
let vector = false;

/** 1024차원 단위 벡터에 가까운 단순 벡터: i번째 축만 1이다. */
const axis = (i: number) => `[${Array.from({ length: 1024 }, (_, k) => (k === i ? 1 : 0)).join(',')}]`;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email) VALUES ($1, $2, 'f-' || $2 || '@x.test')`, [uid, name]);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '파일 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'f-event', '2026-03-13', '2026-03-16')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member')`, [EVENT, U.pm, U.member]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
  vector = await withContext(app, as.pm, (db) => hasVector(db));
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

const upload = (name: string) => withContext(app, as.pm, (db) => insertFile(db, { eventId: EVENT, name, mime: 'text/plain', sizeBytes: 10, storageKey: `k/${name}-${Math.random()}`, uploadedBy: U.pm }));

describe('event_files RLS', () => {
  it('PM·AM만 올릴 수 있고 올린 사람 본인 명의여야 한다', async () => {
    await expect(withContext(app, as.member, (db) => insertFile(db, { eventId: EVENT, name: 'x.txt', mime: '', sizeBytes: 1, storageKey: 'k/m', uploadedBy: U.member }))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.staff, (db) => insertFile(db, { eventId: EVENT, name: 'x.txt', mime: '', sizeBytes: 1, storageKey: 'k/s', uploadedBy: U.staff }))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.pm, (db) => insertFile(db, { eventId: EVENT, name: 'x.txt', mime: '', sizeBytes: 1, storageKey: 'k/o', uploadedBy: U.member }))).rejects.toMatchObject({ code: '42501' });
  });

  it('변환 전에는 편집자만, 변환 후에는 문서를 볼 수 있는 사람이 파일 메타데이터를 본다', async () => {
    const f = await upload('견적.xlsx');
    expect(await withContext(app, as.pm, (db) => getFile(db, f.id))).toBeDefined();
    expect(await withContext(app, as.member, (db) => getFile(db, f.id))).toBeUndefined();

    const doc = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: '견적.xlsx', visibility: 'managers', bodyMd: '표' }));
    await withContext(app, as.pm, (db) => markFile(db, f.id, { status: 'ready', docId: doc.id }));
    expect(await withContext(app, as.member, (db) => getFile(db, f.id))).toBeUndefined(); // PM·AM 전용 문서
    await admin.query(`UPDATE event_docs SET visibility = 'members' WHERE id = $1`, [doc.id]);
    expect(await withContext(app, as.member, (db) => getFile(db, f.id))).toMatchObject({ status: 'ready', docId: doc.id });
    expect(await withContext(app, as.staff, (db) => getFile(db, f.id))).toBeUndefined();
    expect(await withContext(app, as.client, (db) => listFiles(db, EVENT))).toEqual([]);
  });

  it('삭제는 soft delete이고 변환 문서·색인·감사 로그가 따라온다', async () => {
    const f = await upload('삭제.txt');
    const doc = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: '삭제.txt', visibility: 'members', bodyMd: '내용' }));
    await withContext(app, as.pm, async (db) => { await replaceChunks(db, doc.id, EVENT, [{ index: 0, heading: '', content: '내용' }]); await markFile(db, f.id, { status: 'ready', docId: doc.id }); });

    expect(await withContext(app, as.member, (db) => softDeleteFile(db, U.member, f.id))).toBe(false);
    expect(await withContext(app, as.pm, (db) => softDeleteFile(db, U.pm, f.id))).toBe(true);
    expect(await withContext(app, as.pm, (db) => getFile(db, f.id))).toBeUndefined();
    expect((await admin.query('SELECT 1 FROM knowledge_chunks WHERE doc_id = $1', [doc.id])).rowCount).toBe(0);
    expect((await admin.query('SELECT deleted_at FROM event_docs WHERE id = $1', [doc.id])).rows[0]!.deleted_at).not.toBeNull();
    expect((await admin.query(`SELECT 1 FROM audit_log WHERE action = 'file.delete' AND actor_id = $1`, [U.pm])).rowCount).toBe(1);
  });
});

describe.skipIf(!process.env.TEST_PG_EXTERNAL_URL)('dense 검색 (pgvector 서버 필요: TEST_PG_EXTERNAL_URL)', () => {
  const docIds: Record<string, string> = {};

  it('pgvector가 설치되어 있다', () => expect(vector).toBe(true));

  it('임베딩이 없는 청크만 골라 저장하고, 가까운 순으로 찾는다', async () => {
    for (const [key, visibility, axisNo] of [['all', 'all', 1], ['managers', 'managers', 2]] as const) {
      const doc = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: `dense-${key}`, visibility, bodyMd: '' }));
      docIds[key] = doc.id;
      await withContext(app, as.pm, (db) => replaceChunks(db, doc.id, EVENT, [{ index: 0, heading: '', content: `내용 ${key}` }]));
      const pending = await withContext(app, as.pm, (db) => chunksMissingEmbedding(db, doc.id));
      expect(pending).toHaveLength(1);
      expect(await withContext(app, as.pm, (db) => setChunkEmbeddings(db, [pending[0]!.id], [axis(axisNo)]))).toBe(1);
      expect(await withContext(app, as.pm, (db) => chunksMissingEmbedding(db, doc.id))).toHaveLength(0);
    }
    const hits = await withContext(app, as.pm, (db) => searchChunksDense(db, axis(2), { limit: 5 }));
    expect(hits.map((h) => h.title).slice(0, 2)).toEqual(['dense-managers', 'dense-all']);
  });

  it('maxDistance보다 먼 청크는 제외한다', async () => {
    // axis(1)과 axis(2)는 직교(코사인 거리 1)이므로 0.5 안에는 같은 축의 청크만 든다.
    const near = await withContext(app, as.pm, (db) => searchChunksDense(db, axis(1), { limit: 5 }, 0.5));
    expect(near.map((h) => h.title)).toEqual(['dense-all']);
  });

  it('권한 밖 문서는 가까워도 나오지 않는다', async () => {
    expect((await withContext(app, as.member, (db) => searchChunksDense(db, axis(2), { limit: 5 }))).map((h) => h.title)).not.toContain('dense-managers');
    expect((await withContext(app, as.staff, (db) => searchChunksDense(db, axis(1), { limit: 5 }))).map((h) => h.title)).toContain('dense-all');
    expect(await withContext(app, as.client, (db) => searchChunksDense(db, axis(1), { limit: 5 }))).toEqual([]);
  });

  it('본문을 다시 색인하면 임베딩이 비어 다시 만든다', async () => {
    await withContext(app, as.pm, (db) => replaceChunks(db, docIds.all!, EVENT, [{ index: 0, heading: '', content: '바뀐 내용' }]));
    expect(await withContext(app, as.pm, (db) => chunksMissingEmbedding(db, docIds.all!))).toHaveLength(1);
  });

  it('편집 권한이 없으면 임베딩을 쓸 수 없다', async () => {
    const [chunk] = await withContext(app, as.pm, (db) => chunksMissingEmbedding(db, docIds.all!));
    expect(await withContext(app, as.member, (db) => setChunkEmbeddings(db, [chunk!.id], [axis(3)]))).toBe(0);
  });
});
