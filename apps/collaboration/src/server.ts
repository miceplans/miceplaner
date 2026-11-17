import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Server, type Extension } from '@hocuspocus/server';
import * as Y from 'yjs';
import { z } from 'zod';
import { eventRole, getDocPage, getYdocState, saveCollabState, withContext, type Pool } from '@miceplans/db';
import { canEditWiki, canViewDoc } from '@miceplans/domain';
import { replaceYdocWithMarkdown, ydocToMarkdown, ydocToState } from '@miceplans/editor-schema';
import { authenticate, resolveUser, type CollabUser } from './auth';
import { config } from './config';

type Context = { user: CollabUser };

/** 본문이 바뀌어 새로 색인된 뒤에 부르는 후처리. 임베딩이 비어 있는 새 청크를 채우는 작업을 넣는 데 쓴다. */
export type BodyChanged = (docId: string, user: CollabUser) => void | Promise<void>;

const uuid = z.uuid();
const replaceBody = z.object({ userId: uuid, markdown: z.string().max(200_000) });
const syncBody = z.object({ userId: uuid });
const revalidateAccess = z.object({ eventId: uuid, userId: uuid });
const REPLACE_PATH = /^\/internal\/docs\/([0-9a-f-]{36})\/replace$/i;
const SYNC_PATH = /^\/internal\/docs\/([0-9a-f-]{36})\/sync$/i;
const REVALIDATE_ACCESS_PATH = '/internal/access/revalidate';

/** 문서의 Yjs 상태와 Markdown 파생본을 접속한 사용자의 권한으로 저장한다 (RLS: PM·AM만 쓸 수 있다). */
async function persist(pool: Pool, user: CollabUser, docId: string, ydoc: Y.Doc, onBodyChanged?: BodyChanged): Promise<void> {
  const state = ydocToState(ydoc);
  const markdown = ydocToMarkdown(ydoc);
  const changed = await withContext(pool, user, (db) => saveCollabState(db, docId, state, markdown));
  // 저장은 끝났으므로 후처리(임베딩 작업 등) 실패가 편집을 막지 않게 한다.
  if (changed && onBodyChanged) await Promise.resolve(onBodyChanged(docId, user)).catch((error) => console.error('[collab] 본문 변경 후처리 실패', error));
}

const readJson = async (req: IncomingMessage, limit = 400_000): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('본문이 너무 크다');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const secretMatches = (given: string | undefined): boolean => {
  const expected = config.internalSecret;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * 위키 협업 서버 (명세 F-09, ADR). 연결마다 세션 토큰을 검증하고 사용자의 RLS 컨텍스트로 문서를 읽고 쓴다.
 * - Client와 문서를 볼 수 없는 사용자는 연결할 수 없다. PM·AM(과 Super Admin) 외에는 읽기 전용이다.
 * - Yjs 상태가 기준이며 저장할 때 Markdown 파생본과 검색 색인도 함께 갱신한다.
 * - `POST /internal/docs/:id/replace`: 일반 REST 변경·되돌리기를 Yjs 트랜잭션으로 반영할 때 쓴다(공유 비밀 필요).
 * - `POST /internal/docs/:id/sync`: API가 원자적으로 커밋한 AI 승인 Yjs 상태를 활성 연결에 전파한다.
 */
export function createCollabServer(pool: Pool, options: { port?: number; quiet?: boolean; onBodyChanged?: BodyChanged } = {}): Server<Context> {
  // 활성 문서의 행사·열람 범위. RLS를 우회하지 않고 이미 인증 때 읽은 메타데이터만 보관한다.
  const activeDocs = new Map<string, { eventId: string; visibility: 'all' | 'members' | 'managers' }>();
  const extension: Extension<Context> = {
    async onAuthenticate({ token, documentName, connectionConfig }) {
      const user = await authenticate(pool, token);
      if (!user || user.role === 'client' || !uuid.safeParse(documentName).success) throw new Error('forbidden');
      const role = await withContext(pool, user, async (db) => {
        const page = await getDocPage(db, documentName);
        return page ? eventRole(db, page.eventId) : undefined;
      }).catch(() => undefined);
      if (!role) throw new Error('forbidden');
      const page = await withContext(pool, user, (db) => getDocPage(db, documentName)).catch(() => undefined);
      if (!page) throw new Error('forbidden');
      activeDocs.set(documentName, { eventId: page.eventId, visibility: page.visibility });
      connectionConfig.readOnly = !canEditWiki(role);
      return { user };
    },

    async onLoadDocument({ document, documentName, context }) {
      const { user } = context as Context;
      const { state, page } = await withContext(pool, user, async (db) => ({ state: await getYdocState(db, documentName), page: await getDocPage(db, documentName) }));
      if (state) Y.applyUpdate(document, state);
      // 협업으로 편집된 적이 없는 문서는 Markdown 본문으로 시작한다. 저장은 PM·AM이 편집할 때만 일어난다.
      else if (page) replaceYdocWithMarkdown(document, page.bodyMd);
      return document;
    },

    async onStoreDocument({ document, documentName, lastContext }) {
      const user = (lastContext as Context | undefined)?.user;
      if (!user) return;
      await persist(pool, user, documentName, document, options.onBodyChanged);
    },

    async afterUnloadDocument({ documentName }) {
      activeDocs.delete(documentName);
    },

    async onRequest({ request, response, instance }) {
      const url = new URL(request.url ?? '/', 'http://collab');
      if (request.method === 'GET' && url.pathname === '/health') {
        send(response, 200, { ok: true });
        throw null;
      }
      if (url.pathname === REVALIDATE_ACCESS_PATH) {
        if (request.method !== 'POST' || !secretMatches(request.headers['x-internal-secret'] as string | undefined)) {
          send(response, 403, { error: 'forbidden' });
          throw null;
        }
        try {
          const body = revalidateAccess.parse(await readJson(request));
          const user = await resolveUser(pool, body.userId);
          if (user) {
            const role = await withContext(pool, user, (db) => eventRole(db, body.eventId));
            for (const [docId, meta] of activeDocs) {
              if (meta.eventId !== body.eventId) continue;
              const document = instance.documents.get(docId);
              if (!document) continue;
              for (const connection of document.getConnections()) {
                if (connection.context.user.userId === body.userId) {
                  const reason = canViewDoc(meta.visibility, role) ? '권한이 변경되었습니다.' : '문서 접근 권한이 없습니다.';
                  connection.close({ code: 4003, reason } as CloseEvent);
                }
              }
            }
          }
          send(response, 204, null);
        } catch (error) {
          if (error instanceof z.ZodError || error instanceof SyntaxError) send(response, 400, { error: 'invalid request' });
          else send(response, 500, { error: 'failed' });
        }
        throw null;
      }
      const sync = SYNC_PATH.exec(url.pathname);
      if (sync) {
        if (request.method !== 'POST' || !secretMatches(request.headers['x-internal-secret'] as string | undefined)) {
          send(response, 403, { error: 'forbidden' });
          throw null;
        }
        try {
          const body = syncBody.parse(await readJson(request));
          const user = await resolveUser(pool, body.userId);
          const document = instance.documents.get(sync[1]!);
          if (user && document) {
            const state = await withContext(pool, user, (db) => getYdocState(db, sync[1]!));
            if (state) Y.applyUpdate(document as Y.Doc, state, 'api_committed');
          }
          send(response, 204, null);
        } catch (error) {
          send(response, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500, { error: 'failed' });
        }
        throw null;
      }
      const match = REPLACE_PATH.exec(url.pathname);
      if (!match) return;
      if (request.method !== 'POST' || !secretMatches(request.headers['x-internal-secret'] as string | undefined)) {
        send(response, 403, { error: 'forbidden' });
        throw null;
      }
      const docId = match[1]!;
      try {
        const body = replaceBody.parse(await readJson(request));
        const user = await resolveUser(pool, body.userId);
        const allowed = user && (await withContext(pool, user, async (db) => {
          const page = await getDocPage(db, docId);
          return page ? canEditWiki(await eventRole(db, page.eventId)) : false;
        }));
        if (!user || !allowed) {
          send(response, 403, { error: 'forbidden' });
        } else {
          const connection = await instance.openDirectConnection(docId, { user } satisfies Context);
          try {
            await connection.transact((doc) => replaceYdocWithMarkdown(doc, body.markdown));
            await persist(pool, user, docId, connection.document as Y.Doc, options.onBodyChanged);
          } finally {
            await connection.disconnect();
          }
          const version = (await withContext(pool, user, (db) => getDocPage(db, docId)))?.version;
          send(response, 200, { version });
        }
      } catch (error) {
        send(response, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500, { error: 'failed' });
      }
      throw null;
    },
  };

  return new Server<Context>({
    port: options.port ?? config.port,
    quiet: options.quiet,
    stopOnSignals: false,
    debounce: config.debounce,
    maxDebounce: Math.max(config.debounce * 4, 5_000),
    extensions: [extension],
    websocketOptions: { maxPayload: 1024 * 1024 },
  });
}
