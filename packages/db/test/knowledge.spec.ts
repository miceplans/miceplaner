import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDocPage, decideProposal, getDocPage, insertProposal, listProposals, logAiCall, replaceChunks, saveDocBody, searchChunksFts, searchChunksTrigram,
  setDocVisibility, softDeleteDocPage, withContext, type DbContext,
} from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(1011), member: id(1012), staff: id(1013), client: id(1014), admin: id(1015), other: id(1016) };
const EVENT = id(1101);
const OTHER_EVENT = id(1102);
const CO = id(1201);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { pm: ctx(U.pm, 'member'), member: ctx(U.member, 'member'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client'), admin: ctx(U.admin, 'super_admin'), other: ctx(U.other, 'member') };

let app: pg.Pool;
let admin: pg.Pool;
const docs: Record<string, string> = {};

const index = (docId: string, eventId: string, contents: string[]) =>
  withContext(app, as.pm, (db) => replaceChunks(db, docId, eventId, contents.map((content, index) => ({ index, heading: '', content }))));
const fts = (c: DbContext, q: string) => withContext(app, c, async (db) => (await searchChunksFts(db, q, { limit: 10 })).map((h) => h.title));

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email) VALUES ($1, $2, 'k-' || $2 || '@x.test')`, [uid, name]);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '지식 고객사')`, [CO]);
  for (const e of [EVENT, OTHER_EVENT]) await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, $3, '2026-03-13', '2026-03-16')`, [e, CO, `k-event-${e.slice(-3)}`]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member'), ($4,$5,'pm')`, [EVENT, U.pm, U.member, OTHER_EVENT, U.other]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });

  for (const [key, visibility] of [['all', 'all'], ['members', 'members'], ['managers', 'managers']] as const) {
    const page = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: `문서-${key}`, visibility, bodyMd: '' }));
    docs[key] = page.id;
    await index(page.id, EVENT, [`비밀 예산 ${key} 케이터링 견적 정리`]);
  }
  const other = await withContext(app, as.other, (db) => createDocPage(db, { eventId: OTHER_EVENT, title: '다른 행사 문서', visibility: 'all', bodyMd: '' }));
  await withContext(app, as.other, (db) => replaceChunks(db, other.id, OTHER_EVENT, [{ index: 0, heading: '', content: '비밀 예산 다른 행사' }]));
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe('청크 검색 RLS (명세 F-10: 권한 밖 문서는 결과에 나타나지 않는다)', () => {
  const q = "'예산':*";
  it('PM·Super Admin은 자기 행사의 모든 범위를 본다', async () => {
    expect(await fts(as.pm, q)).toEqual(expect.arrayContaining(['문서-all', '문서-members', '문서-managers']));
    expect(await fts(as.admin, q)).toHaveLength(4);
  });
  it('행사 멤버는 PM·AM 전용 문서를 못 본다', async () => {
    expect(await fts(as.member, q)).toEqual(expect.arrayContaining(['문서-all', '문서-members']));
    expect(await fts(as.member, q)).not.toContain('문서-managers');
  });
  it('비멤버 직원은 전체 공개 문서만 본다', async () => {
    expect((await fts(as.staff, q)).filter((t) => t.startsWith('문서-'))).toEqual(['문서-all']);
  });
  it('Client는 어떤 결과도 못 본다', async () => {
    expect(await fts(as.client, q)).toEqual([]);
    const trigram = await withContext(app, as.client, (db) => searchChunksTrigram(db, '비밀 예산', { limit: 10 }));
    expect(trigram).toEqual([]);
  });
  it('열람 범위를 좁히면 즉시 검색에서 사라진다', async () => {
    const doc = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: '곧 숨김', visibility: 'all', bodyMd: '' }));
    await index(doc.id, EVENT, ['숨김테스트 문장']);
    expect(await fts(as.staff, "'숨김테스트':*")).toEqual(['곧 숨김']);
    await withContext(app, as.pm, (db) => setDocVisibility(db, doc.id, 'managers', doc.version, U.pm));
    expect(await fts(as.staff, "'숨김테스트':*")).toEqual([]);
  });
  it('필터는 행사 단위로 좁힌다', async () => {
    const hits = await withContext(app, as.admin, (db) => searchChunksFts(db, q, { eventId: OTHER_EVENT, limit: 10 }));
    expect(hits.map((h) => h.title)).toEqual(['다른 행사 문서']);
  });
  it('조사가 붙은 본문도 접두 일치로 찾고, 어형이 달라도 trigram이 보완한다', async () => {
    const doc = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: '조사 문서', visibility: 'all', bodyMd: '' }));
    await index(doc.id, EVENT, ['담당자에게 일정이 공유되었습니다', '디자이너들과 협업했습니다']);
    expect(await fts(as.pm, "'일정':*")).toContain('조사 문서');
    const trgm = await withContext(app, as.pm, (db) => searchChunksTrigram(db, '디자이너', { limit: 10 }));
    expect(trgm.map((h) => h.title)).toContain('조사 문서');
  });
});

describe('문서 본문과 쓰기 권한', () => {
  it('멤버는 문서를 만들거나 청크를 쓸 수 없다', async () => {
    await expect(withContext(app, as.member, (db) => createDocPage(db, { eventId: EVENT, title: 'x', visibility: 'members', bodyMd: '' }))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.member, (db) => replaceChunks(db, docs.all!, EVENT, [{ index: 0, heading: '', content: 'x' }]))).rejects.toMatchObject({ code: '42501' });
  });
  it('저장할 때마다 version이 오르고 expectedVersion이 어긋나면 null이다', async () => {
    const doc = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: '버전', visibility: 'members', bodyMd: 'a' }));
    const saved = await withContext(app, as.pm, (db) => saveDocBody(db, doc.id, { bodyMd: 'b' }));
    expect(saved).toMatchObject({ bodyMd: 'b', version: doc.version + 1 });
    expect(await withContext(app, as.pm, (db) => saveDocBody(db, doc.id, { bodyMd: 'c' }, doc.version))).toBeNull();
    expect((await withContext(app, as.pm, (db) => saveDocBody(db, doc.id, { bodyMd: 'c' }, doc.version + 1)))?.bodyMd).toBe('c');
  });
  it('멤버의 본문 저장은 0행이라 null이다 (RLS)', async () => {
    expect(await withContext(app, as.member, (db) => saveDocBody(db, docs.members!, { bodyMd: 'hack' }))).toBeNull();
  });
  it('삭제하면 문서와 청크가 사라지고 감사 로그가 남는다. 멤버는 삭제할 수 없다', async () => {
    const doc = await withContext(app, as.pm, (db) => createDocPage(db, { eventId: EVENT, title: '삭제 대상', visibility: 'members', bodyMd: '' }));
    await index(doc.id, EVENT, ['삭제대상 문장']);
    expect(await withContext(app, as.member, (db) => softDeleteDocPage(db, U.member, doc.id))).toBe(false);
    expect(await withContext(app, as.pm, (db) => softDeleteDocPage(db, U.pm, doc.id))).toBe(true);
    expect(await withContext(app, as.pm, (db) => getDocPage(db, doc.id))).toBeUndefined();
    expect(await fts(as.pm, "'삭제대상':*")).toEqual([]);
    const { rows } = await admin.query(`SELECT 1 FROM audit_log WHERE action = 'doc.delete' AND detail->>'docId' = $1`, [doc.id]);
    expect(rows).toHaveLength(1);
  });
});

describe('AI 제안 RLS (명세 F-11: 승인은 PM·AM만)', () => {
  let proposalId: string;
  const draft = { eventId: EVENT, kind: 'task_drafts' as const, summary: '초안', payload: { drafts: [] } };
  it('내부 직원은 제안을 만들 수 있고 Client는 만들 수 없다', async () => {
    proposalId = (await withContext(app, as.staff, (db) => insertProposal(db, U.staff, draft))).id;
    await expect(withContext(app, as.client, (db) => insertProposal(db, U.client, draft))).rejects.toMatchObject({ code: '42501' });
    await expect(withContext(app, as.staff, (db) => insertProposal(db, U.pm, draft))).rejects.toMatchObject({ code: '42501' });
  });
  it('제안은 만든 사람과 PM·AM만 본다', async () => {
    expect(await withContext(app, as.staff, (db) => listProposals(db, EVENT))).toHaveLength(1);
    expect(await withContext(app, as.pm, (db) => listProposals(db, EVENT))).toHaveLength(1);
    expect(await withContext(app, as.member, (db) => listProposals(db, EVENT))).toHaveLength(0);
    expect(await withContext(app, as.client, (db) => listProposals(db, EVENT))).toHaveLength(0);
  });
  it('만든 직원이나 멤버는 승인할 수 없다', async () => {
    expect(await withContext(app, as.staff, (db) => decideProposal(db, U.staff, proposalId, 'approved'))).toBeNull();
    expect(await withContext(app, as.member, (db) => decideProposal(db, U.member, proposalId, 'approved'))).toBeNull();
  });
  it('PM은 한 번만 결정하고 감사 로그가 남는다', async () => {
    expect(await withContext(app, as.pm, (db) => decideProposal(db, U.pm, proposalId, 'approved'))).toMatchObject({ status: 'approved', decidedBy: U.pm });
    expect(await withContext(app, as.pm, (db) => decideProposal(db, U.pm, proposalId, 'rejected'))).toBeNull();
    const { rows } = await admin.query(`SELECT action FROM audit_log WHERE detail->>'proposalId' = $1`, [proposalId]);
    expect(rows).toEqual([{ action: 'ai.proposal.approved' }]);
  });
});

describe('AI 호출 로그', () => {
  const call = { eventId: EVENT, model: 'glm', messages: [{ role: 'user', content: '질문' }], toolCalls: [], promptTokens: 10, completionTokens: 5, latencyMs: 120, error: null };
  it('본인과 Super Admin만 기록을 본다', async () => {
    await withContext(app, as.staff, (db) => logAiCall(db, { ...call, userId: U.staff }));
    await expect(withContext(app, as.staff, (db) => logAiCall(db, { ...call, userId: U.pm }))).rejects.toMatchObject({ code: '42501' });
    const count = (c: DbContext) => withContext(app, c, async (db) => (await db.query('SELECT 1 FROM ai_calls')).rowCount);
    expect(await count(as.staff)).toBe(1);
    expect(await count(as.pm)).toBe(0);
    expect(await count(as.admin)).toBe(1);
  });
});
