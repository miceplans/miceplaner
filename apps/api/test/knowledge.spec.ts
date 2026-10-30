import 'reflect-metadata';
import { SignJWT } from 'jose';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import type { ChatMsg, LlmChunk, LlmClient } from '@miceplans/ai';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { LLM_CLIENT } from '../src/tokens';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(2011), member: id(2012), staff: id(2013), client: id(2014), admin: id(2015), other: id(2016) };
const EVENT = id(2101);
const OTHER_EVENT = id(2102);
const CO = id(2201);
const PROGRAM = id(2301);

let app: INestApplication;
let admin: TestAdmin;
const tokens: Record<string, string> = {};
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (sub: string, role: string) => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).sign(secret());
const as = (user: keyof typeof U) => ({ Authorization: `Bearer ${tokens[user]}` });
const api = () => request(app.getHttpServer());

/** 요청마다 시나리오가 정한 청크를 내보내는 가짜 모델. 모델이 본 메시지는 seen에 남는다. */
let script: (messages: readonly ChatMsg[]) => LlmChunk[] = () => [{ type: 'text', delta: '기본 답변' }];
const seen: ChatMsg[][] = [];
const fakeLlm: LlmClient = {
  model: 'fake-glm',
  async *stream({ messages }) {
    seen.push([...messages]);
    for (const c of script(messages)) yield c;
  },
};
const toolCall = (name: string, args: unknown, callId = 'c1'): LlmChunk => ({ type: 'tool_calls', calls: [{ id: callId, name, arguments: JSON.stringify(args) }] });
const lastIsUser = (m: readonly ChatMsg[]) => m.at(-1)?.role === 'user';
const lastTool = (m: readonly ChatMsg[]) => JSON.parse((m.at(-1) as { content: string }).content);

/** SSE 응답을 이벤트 목록으로 읽는다. */
const chat = async (user: keyof typeof U, body: unknown) => {
  const res = await api().post('/ai/chat').set(as(user)).send(body as object).buffer(true).parse((r, cb) => { let d = ''; r.setEncoding('utf8'); r.on('data', (c) => (d += c)); r.on('end', () => cb(null, d)); });
  const isSse = String(res.headers['content-type']).startsWith('text/event-stream');
  const events = isSse ? (res.body as string).split('\n\n').filter(Boolean).map((b) => JSON.parse(b.split('\n').find((l) => l.startsWith('data: '))!.slice(6))) : [];
  return { status: res.status, events, raw: res.body };
};
const question = (content: string, eventId: string | undefined = EVENT) => ({ eventId, messages: [{ role: 'user', content }] });

const createDoc = async (user: keyof typeof U, title: string, bodyMd: string, visibility = 'members', eventId = EVENT) =>
  (await api().post(`/events/${eventId}/docs`).set(as(user)).send({ title, bodyMd, visibility }).expect(201)).body as { id: string; version: number };

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email, role) VALUES ($1, $2, 'kn-' || $2 || '@x.test', $3)`, [uid, name, name === 'admin' ? 'super_admin' : name === 'client' ? 'client' : 'staff']);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '위키 고객사')`, [CO]);
  for (const e of [EVENT, OTHER_EVENT]) await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, $3, '2026-03-13', '2026-03-16')`, [e, CO, `wiki-event-${e.slice(-3)}`]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member'), ($4,$5,'pm')`, [EVENT, U.pm, U.member, OTHER_EVENT, U.other]);
  await admin.query(`INSERT INTO event_items (id, event_id, kind, title, created_by) VALUES ($1, $2, 'program', '메인 프로그램', $3)`, [PROGRAM, EVENT, U.pm]);
  for (const [name, uid] of Object.entries(U)) tokens[name] = await sign(uid, name === 'admin' ? 'super_admin' : name === 'client' ? 'client' : 'staff');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(LLM_CLIENT).useValue(fakeLlm).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app.close();
  // 같은 클러스터를 쓰는 다른 spec의 개수 검증을 오염시키지 않도록 이 파일이 만든 데이터를 지운다.
  const events = [EVENT, OTHER_EVENT];
  const users = Object.values(U);
  await admin.query(`DELETE FROM ai_calls WHERE user_id = ANY($1)`, [users]);
  await admin.query(`DELETE FROM ai_proposals WHERE event_id = ANY($1)`, [events]);
  await admin.query(`DELETE FROM notifications WHERE event_id = ANY($1)`, [events]);
  await admin.query(`DELETE FROM audit_log WHERE event_id = ANY($1) OR actor_id = ANY($2)`, [events, users]);
  await admin.query(`DELETE FROM knowledge_chunks WHERE event_id = ANY($1)`, [events]);
  await admin.query(`DELETE FROM event_docs WHERE event_id = ANY($1)`, [events]);
  await admin.query(`DELETE FROM event_items WHERE event_id = ANY($1)`, [events]);
  // 마지막 PM 삭제를 막는 트리거는 정리할 때만 끈다.
  await admin.query(`ALTER TABLE event_members DISABLE TRIGGER USER`);
  await admin.query(`DELETE FROM event_members WHERE event_id = ANY($1)`, [events]);
  await admin.query(`ALTER TABLE event_members ENABLE TRIGGER USER`);
  await admin.query(`DELETE FROM events WHERE id = ANY($1)`, [events]);
  await admin.query(`DELETE FROM clients WHERE id = $1`, [CO]);
  await admin.query(`DELETE FROM users WHERE id = ANY($1)`, [users]);
  await admin.end();
});

describe('위키 본문과 권한 (F-09)', () => {
  it('PM만 문서를 만들고 멤버·스태프·Client는 만들 수 없다', async () => {
    for (const u of ['member', 'staff'] as const) await api().post(`/events/${EVENT}/docs`).set(as(u)).send({ title: 'x' }).expect(403);
    await api().post(`/events/${EVENT}/docs`).set(as('client')).send({ title: 'x' }).expect(403);
    await api().post(`/events/${EVENT}/docs`).send({ title: 'x' }).expect(401);
    const doc = await createDoc('pm', '권한 문서', '# 개요\n본문', 'members');
    expect(doc.version).toBe(1);
    await api().post(`/events/${EVENT}/docs`).set(as('pm')).send({ title: '' }).expect(400);
  });
  it('열람 범위가 본문 조회에도 적용된다', async () => {
    const managers = await createDoc('pm', '매니저 전용', '비공개 내용', 'managers');
    const members = await createDoc('pm', '멤버 문서', '멤버 내용', 'members');
    const all = await createDoc('pm', '전체 문서', '전체 내용', 'all');
    expect((await api().get(`/docs/${managers.id}`).set(as('pm')).expect(200)).body.bodyMd).toBe('비공개 내용');
    await api().get(`/docs/${managers.id}`).set(as('member')).expect(404);
    await api().get(`/docs/${members.id}`).set(as('member')).expect(200);
    await api().get(`/docs/${members.id}`).set(as('staff')).expect(404);
    await api().get(`/docs/${all.id}`).set(as('staff')).expect(200);
    await api().get(`/docs/${all.id}`).set(as('client')).expect(403);
  });
  it('본문 저장은 PM만 하고 version이 오른다. 삭제는 감사 로그를 남기고 색인에서 빠진다', async () => {
    const doc = await createDoc('pm', '저장 문서', '처음 내용', 'all');
    await api().put(`/docs/${doc.id}/body`).set(as('member')).send({ bodyMd: '해킹' }).expect(403);
    await api().put(`/docs/${doc.id}/body`).set(as('staff')).send({ bodyMd: '해킹' }).expect(403);
    const saved = await api().put(`/docs/${doc.id}/body`).set(as('pm')).send({ bodyMd: '수정된 고유쿼카단어 내용' }).expect(200);
    expect(saved.body).toMatchObject({ bodyMd: '수정된 고유쿼카단어 내용', version: 2 });
    expect((await api().get('/search').query({ q: '쿼카단어' }).set(as('staff')).expect(200)).body.map((h: { docId: string }) => h.docId)).toEqual([doc.id]);
    await api().delete(`/docs/${doc.id}`).set(as('member')).expect(403);
    await api().delete(`/docs/${doc.id}`).set(as('pm')).expect(204);
    await api().get(`/docs/${doc.id}`).set(as('pm')).expect(404);
    expect((await api().get('/search').query({ q: '쿼카단어' }).set(as('pm')).expect(200)).body).toEqual([]);
    expect((await admin.query(`SELECT 1 FROM audit_log WHERE action = 'doc.delete' AND detail->>'docId' = $1`, [doc.id])).rows).toHaveLength(1);
  });
});

describe('한국어 검색 골든 셋 (F-10, 옵션 C: 형태소 분석기 없음)', () => {
  const docs: Record<string, string> = {};
  const corpus: Record<string, string> = {
    '킥오프 회의록': '# 일정\n3월 13일 행사를 시작한다. 담당자에게 일정이 공유되었습니다.\n\n# 케이터링\n케이터링 업체는 두 곳의 견적을 비교하기로 했다.',
    '디자인 요청 가이드': '# 요청 절차\n디자이너에게 현수막 제작을 요청할 때는 시안 마감일을 먼저 확인한다.\n\n# 3D 영상\n3D 영상 제작은 최소 2주 전에 요청해야 한다.',
    '연차 운영 규정': '연차를 신청할 때는 반차와 반반차를 구분해서 입력한다. 대휴는 주말 근무를 한 뒤에 사용할 수 있다.',
    '회고 2025': '# 문제점\n현장 안내 인력이 부족했고 셔틀버스 배차 간격이 길었다.\n\n# 잘된 점\n고객사 만족도가 높았다.',
  };
  beforeAll(async () => {
    for (const [title, body] of Object.entries(corpus)) docs[title] = (await createDoc('pm', title, body, 'all')).id;
  });

  // [질의, 1순위로 나와야 할 문서]. 활용형·조사가 붙은 질의를 형태소 분석 없이 어간 접두 일치로 찾는지 본다.
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
    ['회고', '회고 2025'],
  ];
  it.each(golden)('"%s" → %s', async (q, title) => {
    const res = await api().get('/search').query({ q, eventId: EVENT }).set(as('staff')).expect(200);
    expect(res.body[0]?.docId, JSON.stringify(res.body.map((h: { title: string }) => h.title))).toBe(docs[title]);
    expect(res.body[0].snippet.length).toBeGreaterThan(0);
  });
  it('질의에 맞는 문서가 없으면 빈 목록이다. 문서당 한 건만 나온다', async () => {
    expect((await api().get('/search').query({ q: '스카이다이빙 보험', eventId: EVENT }).set(as('staff')).expect(200)).body).toEqual([]);
    const hits = (await api().get('/search').query({ q: '요청 영상 제작', eventId: EVENT }).set(as('staff')).expect(200)).body as { docId: string }[];
    expect(new Set(hits.map((h) => h.docId)).size).toBe(hits.length);
  });
  it('제목으로도 검색되고 소제목은 heading으로 나온다', async () => {
    const hit = (await api().get('/search').query({ q: '케이터링', eventId: EVENT }).set(as('staff')).expect(200)).body[0];
    expect(hit).toMatchObject({ title: '킥오프 회의록', heading: '케이터링' });
    expect((await api().get('/search').query({ q: '연차 운영 규정', eventId: EVENT }).set(as('staff')).expect(200)).body[0].title).toBe('연차 운영 규정');
  });
  it('검색 입력 검증: 빈 질의와 큰 limit은 400', async () => {
    await api().get('/search').query({ q: '' }).set(as('staff')).expect(400);
    await api().get('/search').query({ q: '행사', limit: 100 }).set(as('staff')).expect(400);
    await api().get('/search').query({ q: "'; DROP TABLE x; -- & | ! ( ) :*" }).set(as('staff')).expect(200);
  });
});

describe('검색 권한 (F-10: 권한 밖 문서는 제목·인용문도 나오지 않는다)', () => {
  let managersDoc: string;
  let membersDoc: string;
  beforeAll(async () => {
    managersDoc = (await createDoc('pm', '임원 보고', '프로젝트팔콘 비용 구조는 비공개', 'managers')).id;
    membersDoc = (await createDoc('pm', '멤버 보고', '프로젝트팔콘 일정은 멤버 공유', 'members')).id;
  });
  const ids = async (user: keyof typeof U) => (await api().get('/search').query({ q: '프로젝트팔콘' }).set(as(user)).expect(200)).body.map((h: { docId: string }) => h.docId);
  it('역할별로 보이는 범위가 다르다', async () => {
    expect((await ids('pm')).sort()).toEqual([managersDoc, membersDoc].sort());
    expect(await ids('member')).toEqual([membersDoc]);
    expect(await ids('staff')).toEqual([]);
    expect(await ids('admin')).toHaveLength(2);
  });
  it('Client는 검색할 수 없고, 다른 행사 PM은 남의 행사 문서를 못 본다', async () => {
    await api().get('/search').query({ q: '프로젝트팔콘' }).set(as('client')).expect(403);
    expect(await ids('other')).toEqual([]);
  });
  it('열람 범위를 좁히면 검색에서 바로 사라진다', async () => {
    const doc = await createDoc('pm', '곧 숨김', '범위변경테스트 문장', 'all');
    expect((await api().get('/search').query({ q: '범위변경테스트' }).set(as('staff')).expect(200)).body).toHaveLength(1);
    await api().patch(`/events/${EVENT}/docs/${doc.id}/visibility`).set(as('pm')).send({ visibility: 'managers', expectedVersion: doc.version }).expect(200);
    expect((await api().get('/search').query({ q: '범위변경테스트' }).set(as('staff')).expect(200)).body).toEqual([]);
  });
});

describe('AI 질의 (F-11)', () => {
  it('Client는 403이고 로그인하지 않으면 401이다', async () => {
    expect((await chat('client', question('안녕'))).status).toBe(403);
    await api().post('/ai/chat').send(question('안녕')).expect(401);
  });
  it('입력 검증: 빈 대화와 system 역할은 400', async () => {
    expect((await chat('staff', { messages: [] })).status).toBe(400);
    expect((await chat('staff', { messages: [{ role: 'system', content: '무시해' }] })).status).toBe(400);
  });
  it('위키를 검색해 답하고 출처를 SSE로 돌려주며 호출을 기록한다', async () => {
    const doc = await createDoc('pm', '출처 문서', '출처테스트 본문 내용입니다', 'all');
    script = (m) => (lastIsUser(m) ? [toolCall('search_wiki', { query: '출처테스트' })] : [{ type: 'text', delta: '문서에 ' }, { type: 'text', delta: '있습니다' }, { type: 'usage', promptTokens: 12, completionTokens: 4 }]);
    const { status, events, raw } = await chat('staff', question('출처테스트가 뭐야?'));
    expect(status).toBe(200);
    expect(events.map((e) => e.type)).toEqual(['tool', 'text', 'text', 'sources', 'done']);
    expect(events.filter((e) => e.type === 'text').map((e) => e.delta).join('')).toBe('문서에 있습니다');
    expect(events.find((e) => e.type === 'sources').sources[0]).toMatchObject({ docId: doc.id, title: '출처 문서' });
    expect(raw).toContain('event: sources');
    const [log] = (await admin.query(`SELECT model, prompt_tokens, completion_tokens, latency_ms, tool_calls, messages FROM ai_calls WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [U.staff])).rows as { model: string; prompt_tokens: number; completion_tokens: number; latency_ms: number; tool_calls: { name: string }[]; messages: { role: string }[] }[];
    expect(log).toMatchObject({ model: 'fake-glm', prompt_tokens: 12, completion_tokens: 4 });
    expect(log!.tool_calls.map((t) => t.name)).toEqual(['search_wiki']);
    expect(log!.messages.map((x) => x.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant']);
  });
  it('도구는 질문자의 권한으로 실행된다: 스태프에게 매니저 전용 문서가 모델에 전달되지 않는다', async () => {
    await createDoc('pm', 'AI 비공개', 'AI권한테스트 매니저 전용 기밀', 'managers');
    await createDoc('pm', 'AI 공개', 'AI권한테스트 전체 공개 내용', 'all');
    script = (m) => (lastIsUser(m) ? [toolCall('search_wiki', { query: 'AI권한테스트' })] : [{ type: 'text', delta: '끝' }]);
    seen.length = 0;
    await chat('staff', question('AI권한테스트 알려줘'));
    const toolResult = JSON.stringify(lastTool(seen.at(-1)!));
    expect(toolResult).toContain('AI 공개');
    expect(toolResult).not.toContain('기밀');
    expect(toolResult).not.toContain('AI 비공개');
    seen.length = 0;
    await chat('pm', question('AI권한테스트 알려줘'));
    expect(JSON.stringify(lastTool(seen.at(-1)!))).toContain('AI 비공개');
  });
  it('시스템 프롬프트는 서버가 정하고 쓰기 도구는 모델에 제공되지 않는다', async () => {
    script = () => [{ type: 'text', delta: 'x' }];
    seen.length = 0;
    await chat('staff', question('hi'));
    expect(seen[0]![0]).toMatchObject({ role: 'system' });
    expect((seen[0]![0] as { content: string }).content).toContain('propose_*');
  });
  it('모델이 권한 밖 도구 인자(다른 행사 문서)를 읽으려 해도 못 읽는다', async () => {
    const hidden = await createDoc('pm', '남의 문서', '다른 사람 기밀', 'managers');
    script = (m) => (lastIsUser(m) ? [toolCall('read_wiki_page', { docId: hidden.id })] : [{ type: 'text', delta: '못 읽음' }]);
    seen.length = 0;
    const { events } = await chat('staff', question('그 문서 읽어줘'));
    expect(events.find((e) => e.type === 'tool')).toMatchObject({ name: 'read_wiki_page', ok: false });
    expect(JSON.stringify(seen.at(-1))).not.toContain('다른 사람 기밀');
  });
  it('모델 오류는 내부 메시지 없이 error 이벤트로 알리고 호출은 기록한다', async () => {
    script = () => { throw new Error('upstream secret key=abc'); };
    const { events, raw } = await chat('staff', question('실패 시나리오'));
    expect(events.at(-1)).toMatchObject({ type: 'error' });
    expect(raw).not.toContain('secret');
    expect((await admin.query(`SELECT error FROM ai_calls WHERE user_id = $1 AND error IS NOT NULL`, [U.staff])).rows.length).toBeGreaterThan(0);
  });
  it('존재하지 않는 행사 맥락은 403이다', async () => {
    expect((await chat('staff', question('hi', id(9999)))).status).toBe(403);
  });
  it('사용자당 분당 한도를 넘으면 429다', async () => {
    script = () => [{ type: 'text', delta: 'ok' }];
    process.env.AI_REQUESTS_PER_MINUTE = '2';
    try {
      expect((await chat('other', question('1', OTHER_EVENT))).status).toBe(200);
      expect((await chat('other', question('2', OTHER_EVENT))).status).toBe(200);
      expect((await chat('other', question('3', OTHER_EVENT))).status).toBe(429);
    } finally {
      delete process.env.AI_REQUESTS_PER_MINUTE;
    }
  });
});

describe('AI 제안과 승인 (F-11: 승인 전에는 아무것도 바뀌지 않는다)', () => {
  const itemCount = async () => Number((await admin.query(`SELECT count(*) FROM event_items WHERE event_id = $1`, [EVENT])).rows[0]!.count);
  const proposeTasks = async (user: keyof typeof U = 'staff') => {
    script = (m) => (lastIsUser(m)
      ? [toolCall('propose_task_drafts', { eventId: EVENT, summary: '디자인 요청 Task 2개', drafts: [{ kind: 'task', parentId: PROGRAM, title: '현수막 제작' }, { kind: 'task', parentId: PROGRAM, title: '배너 제작', dueOn: '2026-03-10' }] })]
      : [{ type: 'text', delta: '제안했습니다' }]);
    const { events } = await chat(user, question('Task 초안 만들어줘'));
    return events.find((e) => e.type === 'proposal').proposal as { id: string; status: string };
  };

  it('제안만 저장되고 원본은 그대로다. 승인은 PM만 한다', async () => {
    const before = await itemCount();
    const proposal = await proposeTasks();
    expect(proposal.status).toBe('pending');
    expect(await itemCount()).toBe(before);
    // 만든 직원은 제안을 볼 수 있지만 승인할 수 없고(403), 만들지 않은 멤버에게는 제안이 보이지 않는다(404).
    await api().post(`/ai/proposals/${proposal.id}/approve`).set(as('staff')).expect(403);
    await api().post(`/ai/proposals/${proposal.id}/approve`).set(as('member')).expect(404);
    await api().post(`/ai/proposals/${proposal.id}/approve`).set(as('client')).expect(403);
    expect(await itemCount()).toBe(before);

    const approved = await api().post(`/ai/proposals/${proposal.id}/approve`).set(as('pm')).expect(201);
    expect(approved.body).toMatchObject({ status: 'approved', decidedBy: U.pm });
    expect(await itemCount()).toBe(before + 2);
    expect((await admin.query(`SELECT created_by FROM event_items WHERE title = '현수막 제작'`)).rows[0]).toEqual({ created_by: U.pm });
    expect((await admin.query(`SELECT action FROM audit_log WHERE detail->>'proposalId' = $1`, [proposal.id])).rows).toEqual([{ action: 'ai.proposal.approved' }]);
    await api().post(`/ai/proposals/${proposal.id}/approve`).set(as('pm')).expect(409);
    await api().post(`/ai/proposals/${proposal.id}/reject`).set(as('pm')).expect(409);
  });
  it('반려하면 아무것도 만들어지지 않는다', async () => {
    const before = await itemCount();
    const proposal = await proposeTasks();
    await api().post(`/ai/proposals/${proposal.id}/reject`).set(as('staff')).expect(403);
    expect((await api().post(`/ai/proposals/${proposal.id}/reject`).set(as('pm')).expect(201)).body.status).toBe('rejected');
    expect(await itemCount()).toBe(before);
    await api().post(`/ai/proposals/${proposal.id}/approve`).set(as('pm')).expect(409);
  });
  it('제안 목록은 만든 사람과 PM에게만 보인다', async () => {
    const proposal = await proposeTasks('staff');
    const idsOf = async (u: keyof typeof U) => (await api().get(`/events/${EVENT}/ai/proposals`).query({ status: 'pending' }).set(as(u)).expect(200)).body.map((p: { id: string }) => p.id);
    expect(await idsOf('staff')).toContain(proposal.id);
    expect(await idsOf('pm')).toContain(proposal.id);
    expect(await idsOf('member')).not.toContain(proposal.id);
    await api().get(`/events/${EVENT}/ai/proposals`).set(as('client')).expect(403);
  });
  it('잘못된 상위 항목이나 다른 행사의 항목으로는 제안이 만들어지지 않는다', async () => {
    const before = (await admin.query('SELECT count(*) FROM ai_proposals')).rows[0]!.count;
    script = (m) => (lastIsUser(m)
      ? [toolCall('propose_task_drafts', { eventId: EVENT, summary: 's', drafts: [{ kind: 'subtask', parentId: PROGRAM, title: '잘못된 계층' }] })]
      : [{ type: 'text', delta: 'x' }]);
    seen.length = 0;
    const { events } = await chat('staff', question('서브태스크 만들어줘'));
    expect(events.find((e) => e.type === 'tool')).toMatchObject({ ok: false });
    expect(events.some((e) => e.type === 'proposal')).toBe(false);
    expect((await admin.query('SELECT count(*) FROM ai_proposals')).rows[0]!.count).toBe(before);
  });
  it('알림 제안은 승인하면 수신자에게 알림이 생긴다', async () => {
    script = (m) => (lastIsUser(m)
      ? [toolCall('propose_notification', { eventId: EVENT, summary: '마감 알림', recipientId: U.member, kind: 'due_soon', title: '현수막 마감 임박' })]
      : [{ type: 'text', delta: 'x' }]);
    const { events } = await chat('staff', question('알림 제안'));
    const proposal = events.find((e) => e.type === 'proposal').proposal;
    expect((await admin.query(`SELECT 1 FROM notifications WHERE title = '현수막 마감 임박'`)).rows).toHaveLength(0);
    await api().post(`/ai/proposals/${proposal.id}/approve`).set(as('pm')).expect(201);
    expect((await api().get('/notifications').set(as('member')).expect(200)).body.map((n: { title: string }) => n.title)).toContain('현수막 마감 임박');
  });
  it('위키 수정 제안: 승인하면 본문과 색인이 바뀌고, 그 사이 문서가 바뀌었으면 409로 남는다', async () => {
    const doc = await createDoc('pm', '수정 대상', '옛날내용', 'all');
    const proposeEdit = async (baseVersion: number, bodyMd: string) => {
      script = (m) => (lastIsUser(m)
        ? [toolCall('propose_wiki_edit', { docId: doc.id, baseVersion, summary: '본문 교체', bodyMd })]
        : [{ type: 'text', delta: 'x' }]);
      const { events } = await chat('staff', question('수정안'));
      return events.find((e) => e.type === 'proposal')?.proposal as { id: string } | undefined;
    };
    const p1 = (await proposeEdit(1, '새로운내용'))!;
    expect((await api().get(`/docs/${doc.id}`).set(as('pm'))).body.bodyMd).toBe('옛날내용');
    await api().post(`/ai/proposals/${p1.id}/approve`).set(as('pm')).expect(201);
    expect((await api().get(`/docs/${doc.id}`).set(as('pm'))).body).toMatchObject({ bodyMd: '새로운내용', version: 2 });
    expect((await api().get('/search').query({ q: '새로운내용' }).set(as('staff'))).body[0].docId).toBe(doc.id);

    const p2 = (await proposeEdit(2, '충돌날내용'))!;
    await api().put(`/docs/${doc.id}/body`).set(as('pm')).send({ bodyMd: '사람이 먼저 수정' }).expect(200);
    const conflict = await api().post(`/ai/proposals/${p2.id}/approve`).set(as('pm')).expect(409);
    expect(conflict.body).toMatchObject({ code: 'VERSION_CONFLICT', currentVersion: 3 });
    expect((await api().get(`/docs/${doc.id}`).set(as('pm'))).body.bodyMd).toBe('사람이 먼저 수정');
    expect((await admin.query('SELECT status FROM ai_proposals WHERE id = $1', [p2.id])).rows[0]).toEqual({ status: 'pending' });
    expect(await proposeEdit(1, '오래된 version')).toBeUndefined();
  });
});

describe('설정 없는 환경', () => {
  it('LLM이 설정되지 않으면 AI 질의는 503이다 (검색과 위키는 계속 동작)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const bare = moduleRef.createNestApplication();
    await bare.init();
    try {
      const res = await request(bare.getHttpServer()).post('/ai/chat').set(as('staff')).send(question('hi'));
      expect(res.status).toBe(503);
      await request(bare.getHttpServer()).get('/search').query({ q: '회고' }).set(as('staff')).expect(200);
    } finally {
      await bare.close();
    }
  });
});
