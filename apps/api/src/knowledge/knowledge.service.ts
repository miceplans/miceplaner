import { ForbiddenException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { docPageDto, searchHitDto, wikiRevisionDetailDto, wikiRevisionDto, type CreateDocBody, type SaveDocBodyBody, type SearchHitDto, type SearchQuery } from '@miceplans/contracts';
import { canEditWiki } from '@miceplans/domain';
import {
  createDocPage, createRevision, eventRole, getDocPage, getRevision, hasVector, hasYdoc, listRevisions, reindexDocPage, renameDocPage, saveDocBody, searchChunksDense, searchChunksFts, searchChunksTrigram, softDeleteDocPage, withContext,
  type Pool, type PoolClient,
} from '@miceplans/db';
import { makeSnippet, mergeRanked, queryTerms, toTsQuery } from '@miceplans/knowledge';
import { toVectorLiteral, type Embedder } from '@miceplans/knowledge/embed';
import { config } from '../config';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, assertOk, mapDbError } from '../common/http';
import { DB_POOL, EMBEDDER } from '../tokens';
import { CollabClient } from './collab.client';
import { JobQueue } from './job-queue';

/** 한 문서에서 검색 후보로 가져올 청크 수의 여유. 문서당 한 건만 돌려주므로 limit보다 넉넉히 가져온다. */
const CANDIDATE_FACTOR = 3;

const stripTitle = (heading: string, title: string) => (heading === title ? '' : heading.startsWith(`${title} > `) ? heading.slice(title.length + 3) : heading);

const log = new Logger('search');

/** 질의 임베딩이 켜져 있고 pgvector가 있을 때만 dense 후보를 가져온다. 임베딩 서버 장애는 lexical 검색으로 대체한다. */
async function denseCandidates(db: PoolClient, embedding: Promise<number[] | undefined> | null, filter: Parameters<typeof searchChunksFts>[2]) {
  if (!embedding || !(await hasVector(db))) return [];
  try {
    const vector = await embedding;
    return vector ? await searchChunksDense(db, toVectorLiteral(vector), filter, config.denseMaxDistance) : [];
  } catch (error) {
    log.warn(`dense 검색을 건너뛴다: ${String(error)}`);
    return [];
  }
}

/**
 * 권한 필터(RLS) 뒤에 FTS·pg_trgm·dense 결과를 RRF로 병합하고 문서당 가장 좋은 청크 하나만 돌려준다 (명세 F-10).
 * 형태소 분석기 없이 조사를 뗀 어간의 접두 일치로 한국어 활용을 흡수하고, dense는 의미가 비슷한 표현을 보완한다.
 */
export async function searchKnowledge(db: PoolClient, q: Pick<SearchQuery, 'q' | 'eventId' | 'clientId' | 'since' | 'limit'>, embedder?: Embedder | null): Promise<SearchHitDto[]> {
  const terms = queryTerms(q.q);
  if (terms.length === 0) return [];
  const filter = { eventId: q.eventId, clientId: q.clientId, since: q.since, limit: q.limit * CANDIDATE_FACTOR };
  // 임베딩 서버 호출(네트워크)을 DB 조회와 겹쳐 실행한다. 실패는 denseCandidates에서 처리하므로 미리 걸어 둔다.
  const embedding = embedder ? embedder([q.q]).then(([v]) => v) : null;
  embedding?.catch(() => undefined);
  const fts = await searchChunksFts(db, toTsQuery(terms), filter);
  const trigram = await searchChunksTrigram(db, terms.join(' '), filter);
  const dense = await denseCandidates(db, embedding, filter);
  const byId = new Map([...fts, ...trigram, ...dense].map((h) => [h.id, h]));
  const seenDocs = new Set<string>();
  const hits: SearchHitDto[] = [];
  for (const m of mergeRanked([fts, trigram, dense], byId.size)) {
    const h = byId.get(m.id)!;
    if (seenDocs.has(h.docId)) continue;
    seenDocs.add(h.docId);
    hits.push(searchHitDto.parse({ chunkId: h.id, docId: h.docId, eventId: h.eventId, title: h.title, heading: stripTitle(h.heading, h.title), snippet: makeSnippet(h.content, terms), score: m.score, updatedAt: h.updatedAt }));
    if (hits.length >= q.limit) break;
  }
  return hits;
}

/** 행사 위키 본문 CRUD와 검색 (명세 F-09, F-10). Yjs 원본과 협업 편집은 협업 서버 단계에서 붙인다. */
@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CollabClient) private readonly collab: CollabClient,
    @Inject(JobQueue) private readonly queue: JobQueue,
    @Optional() @Inject(EMBEDDER) private readonly embedder: Embedder | null = null,
  ) {}

  /** 본문이 바뀐 문서의 새 청크에 임베딩을 채우도록 작업을 넣는다. */
  private embedLater(user: AuthUser, docId: string): Promise<void> {
    return this.queue.embedDoc({ docId, ctx: { workspaceId: user.workspaceId, userId: user.userId, role: user.role } });
  }

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  private async requireEditor(db: PoolClient, eventId: string) {
    if (!canEditWiki(await eventRole(db, eventId))) throw new ForbiddenException('위키 편집은 PM·AM만 할 수 있다');
  }

  async createDoc(user: AuthUser, eventId: string, body: CreateDocBody) {
    requireInternal(user);
    const page = await this.run(user, async (db) => {
      await this.requireEditor(db, eventId);
      const created = await createDocPage(db, { eventId, ...body });
      await reindexDocPage(db, created);
      return created;
    });
    await this.embedLater(user, page.id);
    return docPageDto.parse(page);
  }

  async getPage(user: AuthUser, docId: string) {
    requireInternal(user);
    return docPageDto.parse(assertFound(await this.run(user, (db) => getDocPage(db, docId)), '문서'));
  }

  /**
   * 제목·본문은 마지막 저장 우선이다. 협업 편집으로 Yjs 상태가 생긴 문서의 본문은 Yjs가 기준이라 협업 서버를 거쳐 바꾸고,
   * 그렇지 않은 문서는 저장과 같은 트랜잭션에서 색인을 갱신한다.
   */
  async saveBody(user: AuthUser, docId: string, body: SaveDocBodyBody) {
    requireInternal(user);
    const { doc, collab } = await this.run(user, async (db) => {
      const doc = assertFound(await getDocPage(db, docId), '문서');
      await this.requireEditor(db, doc.eventId);
      if (await hasYdoc(db, docId)) return { doc, collab: true };
      const saved = assertFound(await saveDocBody(db, docId, body), '문서');
      await reindexDocPage(db, saved);
      return { doc: saved, collab: false };
    });
    if (!collab) {
      await this.embedLater(user, docId);
      return docPageDto.parse(doc);
    }
    await this.collab.replaceBody(user.userId, docId, body.bodyMd);
    return this.renameAfterCollab(user, docId, body.title);
  }

  private async renameAfterCollab(user: AuthUser, docId: string, title?: string) {
    const page = await this.run(user, async (db) => {
      const current = assertFound(await getDocPage(db, docId), '문서');
      if (!title || title === current.title) return current;
      const renamed = assertFound(await renameDocPage(db, docId, title), '문서');
      await reindexDocPage(db, renamed);
      return renamed;
    });
    return docPageDto.parse(page);
  }

  // ── 버전 (명세 F-09: 명시적 버전 생성·AI 제안 승인·되돌리기에서만 만든다) ──

  async createRevision(user: AuthUser, docId: string) {
    requireInternal(user);
    const rev = await this.run(user, async (db) => {
      const doc = assertFound(await getDocPage(db, docId), '문서');
      await this.requireEditor(db, doc.eventId);
      return createRevision(db, user.userId, doc, 'manual');
    });
    return wikiRevisionDto.parse(rev);
  }

  async listRevisions(user: AuthUser, docId: string) {
    requireInternal(user);
    const rows = await this.run(user, async (db) => {
      assertFound(await getDocPage(db, docId), '문서');
      return listRevisions(db, docId);
    });
    return rows.map((r) => wikiRevisionDto.parse(r));
  }

  async getRevision(user: AuthUser, docId: string, revisionId: string) {
    requireInternal(user);
    return wikiRevisionDetailDto.parse(assertFound(await this.run(user, (db) => getRevision(db, docId, revisionId)), '버전'));
  }

  /** 되돌리기: 현재 내용을 먼저 버전으로 남기고 선택한 버전의 본문으로 바꾼다. 감사 로그 대상이다. */
  async restoreRevision(user: AuthUser, docId: string, revisionId: string) {
    requireInternal(user);
    const target = await this.run(user, async (db) => {
      const doc = assertFound(await getDocPage(db, docId), '문서');
      await this.requireEditor(db, doc.eventId);
      const revision = assertFound(await getRevision(db, docId, revisionId), '버전');
      await createRevision(db, user.userId, doc, 'restore');
      await db.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'doc.restore', $3)`, [doc.eventId, user.userId, JSON.stringify({ docId, revisionId })]);
      if (!(await hasYdoc(db, docId))) {
        const saved = assertFound(await saveDocBody(db, docId, { bodyMd: revision.bodyMd }), '문서');
        await reindexDocPage(db, saved);
        return undefined;
      }
      return revision;
    });
    if (target) await this.collab.replaceBody(user.userId, docId, target.bodyMd);
    else await this.embedLater(user, docId);
    return this.getPage(user, docId);
  }

  async remove(user: AuthUser, docId: string): Promise<void> {
    requireInternal(user);
    await this.run(user, async (db) => {
      const doc = assertFound(await getDocPage(db, docId), '문서');
      await this.requireEditor(db, doc.eventId);
      assertOk(await softDeleteDocPage(db, user.userId, docId), '문서');
    });
  }

  async search(user: AuthUser, query: SearchQuery): Promise<SearchHitDto[]> {
    requireInternal(user);
    return this.run(user, (db) => searchKnowledge(db, query, this.embedder));
  }
}
