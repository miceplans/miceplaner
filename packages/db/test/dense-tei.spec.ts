import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chunksMissingEmbedding, createDocPage, hasVector, replaceChunks, searchChunksDense, setChunkEmbeddings, withContext, type DbContext } from '../src';

// 실제 BGE-M3(TEI)로 한국어 골든 셋을 돌려 DENSE_MAX_DISTANCE를 점검한다. 서버가 없으면 건너뛴다.
// 실행: TEST_PG_EXTERNAL_URL=<pgvector 서버> TEST_TEI_URL=http://localhost:8080 pnpm --filter @miceplans/db test dense-tei
const TEI = process.env.TEST_TEI_URL;
const MAX_DISTANCE = Number(process.env.DENSE_MAX_DISTANCE ?? 0.5);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PM = id(3011);
const EVENT = id(3101);
const CO = id(3201);
const pm: DbContext = { workspaceId: 'w1', userId: PM, role: 'member' };

const embed = async (texts: string[]): Promise<number[][]> => {
  const res = await fetch(`${TEI!.replace(/\/$/, '')}/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputs: texts, normalize: true, truncate: true }) });
  if (!res.ok) throw new Error(`TEI ${res.status}`);
  return (await res.json()) as number[][];
};
const lit = (v: number[]) => `[${v.join(',')}]`;

const corpus: Record<string, { heading: string; content: string }[]> = {
  '킥오프 회의록': [
    { heading: '일정', content: '3월 13일 행사를 시작한다. 담당자에게 일정이 공유되었습니다.' },
    { heading: '케이터링', content: '케이터링 업체는 두 곳의 견적을 비교하기로 했다.' },
  ],
  '디자인 요청 가이드': [
    { heading: '요청 절차', content: '디자이너에게 현수막 제작을 요청할 때는 시안 마감일을 먼저 확인한다.' },
    { heading: '3D 영상', content: '3D 영상 제작은 최소 2주 전에 요청해야 한다.' },
  ],
  '연차 운영 규정': [{ heading: '', content: '연차를 신청할 때는 반차와 반반차를 구분해서 입력한다. 대휴는 주말 근무를 한 뒤에 사용할 수 있다.' }],
  '회고 2025': [
    { heading: '문제점', content: '현장 안내 인력이 부족했고 셔틀버스 배차 간격이 길었다.' },
    { heading: '잘된 점', content: '고객사 만족도가 높았다.' },
  ],
};
const golden: [string, string][] = [
  ['행사를 언제 시작해?', '킥오프 회의록'],
  ['담당자에게 공유된 일정', '킥오프 회의록'],
  ['케이터링 업체 견적은 어떻게 비교하나요', '킥오프 회의록'],
  ['현수막 제작을 요청하려면', '디자인 요청 가이드'],
  ['디자이너에게 시안 요청', '디자인 요청 가이드'],
  ['3D 영상은 언제까지 요청해야 해?', '디자인 요청 가이드'],
  ['반차랑 반반차 입력 방법', '연차 운영 규정'],
  ['대휴는 언제 쓸 수 있어', '연차 운영 규정'],
  ['주말에 근무하면', '연차 운영 규정'],
  ['셔틀버스 배차 문제', '회고 2025'],
  ['고객사가 만족했나', '회고 2025'],
];
// 단어 하나짜리 질의(예: '회고')는 관련 문서와도 거리가 0.59여서 무관한 질의(0.60~0.66)와 구분되지 않는다. 임계값으로 풀지 않고 lexical(제목·FTS)이 맡는다.
const offTopic = ['스카이다이빙 보험', '오늘 점심 뭐 먹지', '파이썬 리스트 정렬 방법', '주식 투자 추천', '제주도 날씨', '비트코인 시세'];

describe.skipIf(!process.env.TEST_PG_EXTERNAL_URL || !TEI)('실제 BGE-M3 dense 검색 (F-10)', () => {
  let app: pg.Pool;
  let admin: pg.Pool;
  const docs: Record<string, string> = {};

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
    await admin.query(`INSERT INTO users (id, name, email) VALUES ($1, 'tei-pm', 'tei-pm@x.test')`, [PM]);
    await admin.query(`INSERT INTO clients (id, name) VALUES ($1, 'TEI 고객사')`, [CO]);
    await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'tei-event', '2026-03-13', '2026-03-16')`, [EVENT, CO]);
    await admin.query(`INSERT INTO event_members VALUES ($1, $2, 'pm')`, [EVENT, PM]);
    app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
    expect(await withContext(app, pm, (db) => hasVector(db))).toBe(true);
    for (const [title, chunks] of Object.entries(corpus)) {
      const doc = await withContext(app, pm, (db) => createDocPage(db, { eventId: EVENT, title, visibility: 'all', bodyMd: '' }));
      docs[title] = doc.id;
      await withContext(app, pm, (db) => replaceChunks(db, doc.id, EVENT, chunks.map((c, index) => ({ index, ...c }))));
      // 워커와 같은 입력 형식: `${heading}\n${content}`
      const pending = await withContext(app, pm, (db) => chunksMissingEmbedding(db, doc.id));
      const vectors = await embed(pending.map((c) => `${c.heading}\n${c.content}`.trim()));
      await withContext(app, pm, (db) => setChunkEmbeddings(db, pending.map((c) => c.id), vectors.map(lit)));
    }
  });
  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  const nearest = async (q: string, maxDistance?: number) => {
    const [v] = await embed([q]);
    return withContext(app, pm, (db) => searchChunksDense(db, lit(v!), { eventId: EVENT, limit: 5 }, maxDistance));
  };

  it.each(golden)(`"%s" → %s (거리 ${MAX_DISTANCE} 이내)`, async (q, title) => {
    const hits = await nearest(q, MAX_DISTANCE);
    expect(hits[0]?.docId, JSON.stringify(hits.map((h) => h.title))).toBe(docs[title]);
  });

  it.each(offTopic)(`무관한 질의 "%s"는 거리 ${MAX_DISTANCE} 안에 아무것도 없다`, async (q) => {
    expect(await nearest(q, MAX_DISTANCE)).toEqual([]);
  });
});
