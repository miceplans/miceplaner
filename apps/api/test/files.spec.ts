import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MAX_FILE_BYTES } from '@miceplans/contracts';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import { EMBEDDING_DIM, type Embedder } from '@miceplans/knowledge/embed';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { EMBEDDER } from '../src/tokens';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(4011), member: id(4012), staff: id(4013), client: id(4014) };
const EVENT = id(4101);
const CO = id(4201);

let app: INestApplication;
let admin: TestAdmin;
const tokens: Record<string, string> = {};
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (sub: string, role: string) => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).sign(secret());
const as = (user: keyof typeof U) => ({ Authorization: `Bearer ${tokens[user]}` });
const api = () => request(app.getHttpServer());

/** 질의에 '행사 장소'가 들어 있으면 축 0, 아니면 축 1을 가리키는 가짜 임베딩. */
const axisVector = (i: number) => Array.from({ length: EMBEDDING_DIM }, (_, k) => (k === i ? 1 : 0));
const fakeEmbedder: Embedder = async (texts) => texts.map((t) => axisVector(t.includes('어디서') ? 0 : 1));

const upload = (user: keyof typeof U, name: string, content: Buffer | string = '내용', eventId = EVENT) =>
  api().post(`/events/${eventId}/files`).set(as(user)).attach('file', Buffer.from(content), { filename: name, contentType: 'text/plain' });

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email, role) VALUES ($1, $2, 'fl-' || $2 || '@x.test', $3)`, [uid, name, name === 'client' ? 'client' : 'staff']);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '파일 API 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'file-api-event', '2026-03-13', '2026-03-16')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member')`, [EVENT, U.pm, U.member]);
  for (const [name, uid] of Object.entries(U)) tokens[name] = await sign(uid, name === 'client' ? 'client' : 'staff');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(EMBEDDER).useValue(fakeEmbedder).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app.close();
  // 같은 클러스터를 쓰는 다른 spec의 개수 검증을 오염시키지 않도록 이 파일이 만든 데이터를 지운다.
  await admin.query(`DELETE FROM pgboss.job WHERE data->>'fileId' IN (SELECT id::text FROM event_files WHERE event_id = $1)`, [EVENT]);
  await admin.query(`DELETE FROM event_files WHERE event_id = $1`, [EVENT]);
  await admin.query(`DELETE FROM audit_log WHERE event_id = $1 OR actor_id = ANY($2)`, [EVENT, Object.values(U)]);
  await admin.query(`DELETE FROM knowledge_chunks WHERE event_id = $1`, [EVENT]);
  await admin.query(`DELETE FROM event_docs WHERE event_id = $1`, [EVENT]);
  await admin.query(`ALTER TABLE event_members DISABLE TRIGGER USER`); // 마지막 PM 삭제를 막는 트리거
  await admin.query(`DELETE FROM event_members WHERE event_id = $1`, [EVENT]);
  await admin.query(`ALTER TABLE event_members ENABLE TRIGGER USER`);
  await admin.query(`DELETE FROM events WHERE id = $1`, [EVENT]);
  await admin.query(`DELETE FROM clients WHERE id = $1`, [CO]);
  await admin.query(`DELETE FROM users WHERE id = ANY($1)`, [Object.values(U)]);
  await admin.end();
});

describe('파일 업로드 (명세 F-10)', () => {
  it('PM·AM이 올리면 pending 파일이 만들어지고 원본이 저장소에 있으며 변환 작업이 큐에 들어간다', async () => {
    const res = await upload('pm', '케이터링 견적서.txt', '케이터링 견적').expect(201);
    expect(res.body).toMatchObject({ name: '케이터링 견적서.txt', status: 'pending', docId: null, eventId: EVENT, uploadedBy: U.pm });
    const row = (await admin.query(`SELECT storage_key FROM event_files WHERE id = $1`, [res.body.id])).rows[0]!;
    expect(existsSync(join(process.env.FILES_DIR!, row.storage_key as string))).toBe(true);
    const jobs = (await admin.query(`SELECT data FROM pgboss.job WHERE name = 'parse-file' AND data->>'fileId' = $1`, [res.body.id])).rows;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.data).toMatchObject({ fileId: res.body.id, ctx: { userId: U.pm } });
  });

  it('멤버·스태프·Client는 올릴 수 없고 저장소에 아무것도 남기지 않는다', async () => {
    const before = (await admin.query(`SELECT count(*)::int AS n FROM event_files`)).rows[0]!.n;
    for (const user of ['member', 'staff', 'client'] as const) await upload(user, 'x.txt').expect(403);
    expect((await admin.query(`SELECT count(*)::int AS n FROM event_files`)).rows[0]!.n).toBe(before);
  });

  it('지원하지 않는 형식, 파일 없음, 상한 초과는 거부한다', async () => {
    await upload('pm', 'run.exe').expect(400);
    await upload('pm', '확장자없음').expect(400);
    await api().post(`/events/${EVENT}/files`).set(as('pm')).field('x', 'y').expect(400);
    await upload('pm', 'big.txt', Buffer.alloc(MAX_FILE_BYTES + 1, 97)).expect(413);
  });

  it('경로 구분자가 든 파일명은 안전하게 바꾼다', async () => {
    const res = await upload('pm', '../../etc/passwd.txt').expect(201);
    expect(res.body.name).not.toContain('/');
  });

  it('인증이 없으면 401이다', async () => {
    await api().post(`/events/${EVENT}/files`).attach('file', Buffer.from('x'), 'a.txt').expect(401);
  });
});

describe('파일 조회·다운로드·삭제', () => {
  let fileId: string;
  let docId: string;
  beforeAll(async () => {
    fileId = (await upload('pm', '공유 자료.txt', '공유할 본문').expect(201)).body.id;
    // worker가 하는 일을 흉내 낸다 (실제 변환은 apps/worker 테스트가 검증한다).
    docId = (await admin.query(`INSERT INTO event_docs (event_id, title, visibility, body_md) VALUES ($1, '공유 자료.txt', 'managers', '공유할 본문') RETURNING id`, [EVENT])).rows[0]!.id as string;
    await admin.query(`UPDATE event_files SET status = 'ready', doc_id = $2 WHERE id = $1`, [fileId, docId]);
  });

  it('변환 문서의 열람 범위를 따른다 (PM·AM 전용이면 멤버에게 보이지 않는다)', async () => {
    expect((await api().get(`/events/${EVENT}/files`).set(as('pm')).expect(200)).body.map((f: { id: string }) => f.id)).toContain(fileId);
    expect((await api().get(`/events/${EVENT}/files`).set(as('member')).expect(200)).body).toEqual([]);
    await api().get(`/files/${fileId}`).set(as('member')).expect(404);
    await admin.query(`UPDATE event_docs SET visibility = 'members' WHERE id = $1`, [docId]);
    expect((await api().get(`/files/${fileId}`).set(as('member')).expect(200)).body).toMatchObject({ status: 'ready', docId });
    await api().get(`/files/${fileId}`).set(as('staff')).expect(404);
  });

  it('Client는 목록·상세·다운로드 어디서도 접근할 수 없다', async () => {
    await api().get(`/events/${EVENT}/files`).set(as('client')).expect(403);
    await api().get(`/files/${fileId}`).set(as('client')).expect(403);
    await api().get(`/files/${fileId}/download`).set(as('client')).expect(403);
  });

  it('다운로드는 원본 바이트를 첨부 파일로 돌려준다', async () => {
    const res = await api().get(`/files/${fileId}/download`).set(as('member')).buffer(true).parse((r, cb) => { const chunks: Buffer[] = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); }).expect(200);
    expect((res.body as Buffer).toString('utf8')).toBe('공유할 본문');
    expect(res.headers['content-disposition']).toContain(`filename*=UTF-8''${encodeURIComponent('공유 자료.txt')}`);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('삭제는 PM·AM만, soft delete로 변환 문서·색인을 내리고 감사 로그를 남긴다', async () => {
    await admin.query(`INSERT INTO knowledge_chunks (doc_id, event_id, chunk_index, content) VALUES ($1, $2, 0, '공유할 본문')`, [docId, EVENT]);
    await api().delete(`/files/${fileId}`).set(as('member')).expect(403);
    await api().delete(`/files/${fileId}`).set(as('pm')).expect(204);
    await api().get(`/files/${fileId}`).set(as('pm')).expect(404);
    expect((await admin.query(`SELECT 1 FROM knowledge_chunks WHERE doc_id = $1`, [docId])).rowCount).toBe(0);
    expect((await admin.query(`SELECT deleted_at FROM event_docs WHERE id = $1`, [docId])).rows[0]!.deleted_at).not.toBeNull();
    expect((await admin.query(`SELECT 1 FROM audit_log WHERE action = 'file.delete' AND event_id = $1`, [EVENT])).rowCount).toBe(1);
    await api().delete(`/files/${fileId}`).set(as('pm')).expect(404);
  });
});

describe.skipIf(!process.env.TEST_PG_EXTERNAL_URL)('dense 검색 병합 (pgvector 서버 필요)', () => {
  it('어휘가 겹치지 않아도 의미가 가까운 문서를 찾고, 권한 밖 문서는 제외한다', async () => {
    const make = async (title: string, visibility: string, content: string, axis: number) => {
      const docId = (await admin.query(`INSERT INTO event_docs (event_id, title, visibility, body_md) VALUES ($1, $2, $3, $4) RETURNING id`, [EVENT, title, visibility, content])).rows[0]!.id as string;
      const chunkId = (await admin.query(`INSERT INTO knowledge_chunks (doc_id, event_id, chunk_index, content) VALUES ($1, $2, 0, $3) RETURNING id`, [docId, EVENT, content])).rows[0]!.id as string;
      await admin.query(`UPDATE knowledge_chunks SET embedding = $2::vector WHERE id = $1`, [chunkId, `[${axisVector(axis).join(',')}]`]);
      return docId;
    };
    const venue = await make('개최 위치 안내', 'members', '코엑스 3층 그랜드볼룸에서 열린다.', 0);
    const secretDoc = await make('비공개 위치 메모', 'managers', '대관 계약 세부 조건.', 0);
    await make('무관한 문서', 'members', '케이터링 메뉴 목록.', 1);

    const pm = (await api().get('/search').query({ q: '행사 어디서 해요', eventId: EVENT }).set(as('pm')).expect(200)).body as { docId: string }[];
    expect(pm.map((h) => h.docId)).toEqual(expect.arrayContaining([venue, secretDoc]));
    expect(pm.map((h) => h.docId)).not.toContain(undefined);

    const member = (await api().get('/search').query({ q: '행사 어디서 해요', eventId: EVENT }).set(as('member')).expect(200)).body as { docId: string }[];
    expect(member.map((h) => h.docId)).toContain(venue);
    expect(member.map((h) => h.docId)).not.toContain(secretDoc);
    await api().get('/search').query({ q: '행사 어디서 해요' }).set(as('client')).expect(403);
  });
});

describe('항목 첨부와 이동 (F-04)', () => {
  const OTHER = id(4102);

  afterAll(async () => {
    // 이 describe가 만든 항목과 다른 행사 데이터를 정리한다 (파일 수준 afterAll은 항목을 지우지 않아 FK로 실패한다).
    for (const eventId of [EVENT, OTHER]) {
      await admin.query(`DELETE FROM pgboss.job WHERE data->>'fileId' IN (SELECT id::text FROM event_files WHERE event_id = $1)`, [eventId]);
      await admin.query(`DELETE FROM event_files WHERE event_id = $1`, [eventId]);
      await admin.query(`DELETE FROM event_items WHERE event_id = $1`, [eventId]);
    }
    await admin.query(`ALTER TABLE event_members DISABLE TRIGGER USER`); // 마지막 PM 삭제를 막는 트리거
    await admin.query(`DELETE FROM event_members WHERE event_id = $1`, [OTHER]);
    await admin.query(`ALTER TABLE event_members ENABLE TRIGGER USER`);
    await admin.query(`DELETE FROM events WHERE id = $1`, [OTHER]);
  });

  it('업로드 때 항목에 첨부하고 itemId로 필터링한다', async () => {
    const item = (await api().post(`/events/${EVENT}/items`).set(as('pm')).send({ kind: 'program', title: '첨부 프로그램' }).expect(201)).body.id;
    const res = await upload('pm', '항목 첨부.txt', '본문').field('itemId', item).expect(201);
    expect(res.body).toMatchObject({ itemId: item, status: 'pending' });
    const filtered = await api().get(`/events/${EVENT}/files?itemId=${item}`).set(as('pm')).expect(200);
    expect(filtered.body.map((f: { id: string }) => f.id)).toEqual([res.body.id]);
  });

  it('다른 행사의 항목에는 첨부할 수 없다', async () => {
    await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'other', '2026-04-01', '2026-04-02')`, [OTHER, CO]);
    await admin.query(`INSERT INTO event_members VALUES ($1, $2, 'pm')`, [OTHER, U.pm]);
    const otherItem = (await api().post(`/events/${OTHER}/items`).set(as('pm')).send({ kind: 'program', title: '타 행사' }).expect(201)).body.id;
    await upload('pm', 'x.txt', 'x').field('itemId', otherItem).expect(409);
  });

  it('이동은 PM·AM만 하고 같은 행사의 항목으로만 가능하다', async () => {
    const item = (await api().post(`/events/${EVENT}/items`).set(as('pm')).send({ kind: 'program', title: '이동 대상' }).expect(201)).body.id;
    const otherItem = (await api().get(`/events/${OTHER}/items`).set(as('pm')).expect(200)).body[0].id;
    const res = await upload('pm', '이동.txt', '본문').expect(201);
    const fileId = res.body.id;
    // member에게 보이는 파일로 만들어 권한 검사 지점까지 도달하게 한다.
    const doc = (await admin.query(`INSERT INTO event_docs (event_id, title, visibility, body_md) VALUES ($1, '이동.txt', 'members', '본문') RETURNING id`, [EVENT])).rows[0]!.id;
    await admin.query(`UPDATE event_files SET status = 'ready', doc_id = $2 WHERE id = $1`, [fileId, doc]);

    await api().patch(`/files/${fileId}`).set(as('member')).send({ itemId: item }).expect(403);
    await api().patch(`/files/${fileId}`).set(as('pm')).send({ itemId: otherItem }).expect(409);
    await api().patch(`/files/${fileId}`).set(as('pm')).send({ itemId: id(4999) }).expect(404);
    await api().patch(`/files/${fileId}`).set(as('pm')).send({ itemId: item }).expect(200).expect((r) => expect(r.body.itemId).toBe(item));
    const root = await api().patch(`/files/${fileId}`).set(as('pm')).send({ itemId: null }).expect(200);
    expect(root.body.itemId).toBeNull();
  });
});
