import { SignJWT } from 'jose';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import { createPool, type Pool } from '@miceplans/db';
import { markdownToYdoc, replaceYdocWithMarkdown, ydocToMarkdown, ydocToState } from '@miceplans/editor-schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCollabServer } from '../src/server';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(3011), admin: id(3012), member: id(3013), staff: id(3014), client: id(3015) };
const EVENT = id(3101);
const CO = id(3201);
const DOC = { members: id(3301), managers: id(3302), all: id(3303), edit: id(3304), api: id(3305), reload: id(3306) };

let admin: TestAdmin;
let pool: Pool;
let server: ReturnType<typeof createCollabServer>;
let url: string;
const tokens: Record<string, string> = {};
const sign = (sub: string, role: string) => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const open: HocuspocusProvider[] = [];

type Client = { doc: Y.Doc; provider: HocuspocusProvider; synced: Promise<void>; failed: Promise<string> };
const connect = (name: string, token: string, base = url): Client => {
  const doc = new Y.Doc();
  let onSynced!: () => void;
  let onFailed!: (reason: string) => void;
  const synced = new Promise<void>((r) => (onSynced = r));
  const failed = new Promise<string>((r) => (onFailed = r));
  const provider = new HocuspocusProvider({
    url: base, name, token, document: doc,
    onSynced: () => onSynced(), onAuthenticationFailed: ({ reason }) => onFailed(reason),
  });
  open.push(provider);
  return { doc, provider, synced, failed };
};
const until = async <T>(fn: () => Promise<T | false | undefined> | T | false | undefined, ms = 5_000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('시간 초과');
    await new Promise((r) => setTimeout(r, 25));
  }
};
const body = async (docId: string) => (await admin.query('SELECT body_md, version FROM event_docs WHERE id = $1', [docId])).rows[0] as { body_md: string; version: number };
const md = (c: Client) => ydocToMarkdown(c.doc).trim();
const changed: { docId: string; userId: string }[] = [];
const internal = (docId: string, payload: unknown, secret: string | null = 'internal-test-secret') =>
  fetch(`${url.replace('ws:', 'http:')}/internal/docs/${docId}/replace`, { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-internal-secret': secret } : {}) }, body: JSON.stringify(payload) });

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email, role) VALUES ($1, $2, 'co-' || $2 || '@x.test', $3)`, [uid, name, name === 'admin' ? 'super_admin' : name === 'client' ? 'client' : 'staff']);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '협업 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'collab-event', '2026-03-13', '2026-03-16')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member')`, [EVENT, U.pm, U.member]);
  for (const [key, visibility, text] of [['members', 'members', '# 멤버 문서\n\n멤버 본문'], ['managers', 'managers', '매니저 본문'], ['all', 'all', '전체 본문'], ['edit', 'members', '# 편집 문서\n\n처음 내용'], ['api', 'members', '# API 문서\n\n옛 내용'], ['reload', 'members', '재접속 전 내용']] as const) {
    await admin.query(`INSERT INTO event_docs (id, event_id, title, visibility, body_md) VALUES ($1, $2, $3, $4, $5)`, [DOC[key], EVENT, key, visibility, text]);
  }
  for (const [name, uid] of Object.entries(U)) tokens[name] = await sign(uid, name === 'admin' ? 'super_admin' : name === 'client' ? 'client' : 'staff');
  pool = createPool(process.env.DATABASE_URL!);
  server = createCollabServer(pool, { port: 0, quiet: true, onBodyChanged: (docId, user) => { changed.push({ docId, userId: user.userId }); } });
  await server.listen();
  url = server.webSocketURL;
});
afterAll(async () => {
  open.forEach((p) => p.destroy());
  await server.destroy();
  await pool.end();
  await admin.end();
});

describe('접속 권한 (F-09)', () => {
  it('Client, 잘못된 토큰, 문서를 볼 수 없는 직원, 없는 문서는 연결할 수 없다', async () => {
    for (const [name, token] of [[DOC.members, tokens.client!], [DOC.members, 'garbage'], [DOC.members, tokens.staff!], [DOC.managers, tokens.member!], [id(9999), tokens.pm!], ['not-a-uuid', tokens.pm!]] as const) {
      const c = connect(name, token);
      expect(await Promise.race([c.failed, c.synced.then(() => 'synced')]), `${name} ${token.slice(0, 6)}`).not.toBe('synced');
    }
  });
  it('전체 공개 문서는 비멤버 직원도 읽기 전용으로 연결한다', async () => {
    const c = connect(DOC.all, tokens.staff!);
    await c.synced;
    expect(md(c)).toBe('전체 본문');
    expect(c.provider.authorizedScope).toBe('readonly');
  });
  it('PM은 편집 가능, 행사 멤버는 읽기 전용이다', async () => {
    const pm = connect(DOC.members, tokens.pm!);
    const member = connect(DOC.members, tokens.member!);
    await Promise.all([pm.synced, member.synced]);
    expect(pm.provider.authorizedScope).toBe('read-write');
    expect(member.provider.authorizedScope).toBe('readonly');
    expect(md(member)).toBe('# 멤버 문서\n\n멤버 본문');
  });
});

describe('협업 편집과 저장', () => {
  it('Markdown 본문으로 시작하고, PM의 편집은 Yjs 상태·본문·검색 색인에 저장되며 다른 접속자에게 전파된다', async () => {
    const pm = connect(DOC.edit, tokens.pm!);
    const admin2 = connect(DOC.edit, tokens.admin!);
    const viewer = connect(DOC.edit, tokens.member!);
    await Promise.all([pm.synced, admin2.synced, viewer.synced]);
    expect(md(pm)).toBe('# 편집 문서\n\n처음 내용');

    replaceYdocWithMarkdown(pm.doc, '# 편집 문서\n\n협업고유단어 수정됨');
    await until(() => md(admin2).includes('협업고유단어'));
    await until(() => md(viewer).includes('협업고유단어'));
    const saved = await until(async () => {
      const row = await body(DOC.edit);
      return row.body_md.includes('협업고유단어') && row;
    });
    expect(saved.version).toBeGreaterThan(1);
    expect((await admin.query('SELECT 1 FROM wiki_ydoc WHERE doc_id = $1', [DOC.edit])).rowCount).toBe(1);
    const chunks = await admin.query(`SELECT 1 FROM knowledge_chunks WHERE doc_id = $1 AND content LIKE '%협업고유단어%'`, [DOC.edit]);
    expect(chunks.rowCount).toBe(1);
  });
  it('읽기 전용 접속자가 보낸 변경은 반영도 저장도 되지 않는다', async () => {
    const pm = connect(DOC.all, tokens.pm!);
    const staff = connect(DOC.all, tokens.staff!);
    await Promise.all([pm.synced, staff.synced]);
    replaceYdocWithMarkdown(staff.doc, '스태프가 덮어쓴 내용');
    await new Promise((r) => setTimeout(r, 400));
    expect(md(pm)).toBe('전체 본문');
    expect((await body(DOC.all)).body_md).toBe('전체 본문');
  });
  it('서버를 다시 띄워도 저장된 상태에서 이어간다', async () => {
    const first = connect(DOC.reload, tokens.pm!);
    await first.synced;
    replaceYdocWithMarkdown(first.doc, '재접속 후에도 남는 내용');
    await until(async () => (await body(DOC.reload)).body_md === '재접속 후에도 남는 내용');
    first.provider.destroy();
    const second = createCollabServer(pool, { port: 0, quiet: true });
    await second.listen();
    try {
      const again = connect(DOC.reload, tokens.member!, second.webSocketURL);
      await again.synced;
      expect(md(again)).toBe('재접속 후에도 남는 내용');
    } finally {
      await second.destroy();
    }
  });
});

describe('내부 변경 API (AI 제안 승인·되돌리기)', () => {
  it('공유 비밀이 없거나 틀리면 거부한다', async () => {
    expect((await internal(DOC.api, { userId: U.pm, markdown: 'x' }, null)).status).toBe(403);
    expect((await internal(DOC.api, { userId: U.pm, markdown: 'x' }, 'wrong')).status).toBe(403);
    expect((await body(DOC.api)).body_md).toBe('# API 문서\n\n옛 내용');
  });
  it('편집 권한이 없는 사용자 id로는 거부한다', async () => {
    for (const userId of [U.member, U.staff, U.client]) expect((await internal(DOC.api, { userId, markdown: 'x' })).status).toBe(403);
    expect((await internal(DOC.api, { userId: 'bad', markdown: 'x' })).status).toBe(400);
  });
  it('접속 중인 편집자에게 Yjs 트랜잭션으로 전파되고 본문·색인·version이 갱신된다', async () => {
    const live = connect(DOC.api, tokens.pm!);
    await live.synced;
    const before = (await body(DOC.api)).version;
    const res = await internal(DOC.api, { userId: U.pm, markdown: '# API 문서\n\nAI가 고친 내용' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { version: number }).version).toBe(before + 1);
    await until(() => md(live) === '# API 문서\n\nAI가 고친 내용');
    expect((await body(DOC.api)).body_md).toBe('# API 문서\n\nAI가 고친 내용');
    // 접속자 사본과 서버 상태가 중복 없이 같은 문서로 병합되어 있다.
    const stored = await admin.query('SELECT state FROM wiki_ydoc WHERE doc_id = $1', [DOC.api]);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, stored.rows[0]!.state as Uint8Array);
    expect(ydocToMarkdown(restored).trim()).toBe('# API 문서\n\nAI가 고친 내용');
    expect(ydocToState(markdownToYdoc('x')).length).toBeGreaterThan(0);
  });
  it('본문이 바뀌어 저장될 때만 후처리(임베딩 작업)를 부른다', async () => {
    const before = changed.filter((c) => c.docId === DOC.reload).length;
    const live = connect(DOC.reload, tokens.pm!);
    await live.synced;
    replaceYdocWithMarkdown(live.doc, '후처리 확인 내용');
    await until(() => changed.filter((c) => c.docId === DOC.reload).length > before);
    expect(changed.filter((c) => c.docId === DOC.reload).at(-1)).toEqual({ docId: DOC.reload, userId: U.pm });
    // 같은 내용으로 다시 교체해도 본문이 같으면 부르지 않는다.
    const count = changed.length;
    expect((await internal(DOC.reload, { userId: U.pm, markdown: '후처리 확인 내용' })).status).toBe(200);
    expect(changed.length).toBe(count);
  });
  it('GET /health는 인증 없이 응답한다', async () => {
    expect((await fetch(`${url.replace('ws:', 'http:')}/health`)).status).toBe(200);
  });
});
