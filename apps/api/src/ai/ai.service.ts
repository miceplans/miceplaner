import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import {
  PROPOSAL_PAYLOADS, proposalDto, type AgentToolName, type ChatBody, type ChatEvent, type SearchHitDto,
} from '@miceplans/contracts';
import { PARENT_KIND, canQueryAi } from '@miceplans/domain';
import { runAgent, systemPrompt, ToolError, type ChatMsg, type LlmClient, type ToolHandlers } from '@miceplans/ai';
import {
  getDocPage, getEvent, getItem, insertProposal, listEvents, listItems, logAiCall, withContext, type Pool, type PoolClient,
} from '@miceplans/db';
import { AuthUser } from '../common/auth';
import { config } from '../config';
import { searchKnowledge } from '../knowledge/knowledge.service';
import type { Embedder } from '@miceplans/knowledge/embed';
import { DB_POOL, EMBEDDER, LLM_CLIENT } from '../tokens';

const MAX_PAGE_CHARS = 20_000;
const LOG_CONTENT_CHARS = 4_000;
const SEARCH_LIMIT_DEFAULT = 5;

const PROPOSAL_NOTE = '제안이 저장되었다. PM·AM이 승인하기 전에는 아무것도 바뀌지 않는다. 사용자에게 승인이 필요하다고 알려라.';

/** AI 질의 오케스트레이션 (명세 F-11). 도구는 호출한 사용자의 RLS 컨텍스트에서 실행되고, 쓰기 도구는 없다. */
@Injectable()
export class AiService {
  private readonly calls = new Map<string, number[]>();

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Optional() @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
    @Optional() @Inject(EMBEDDER) private readonly embedder: Embedder | null = null,
  ) {}

  /** 사용자당 분당 한도. 인스턴스 메모리로 충분하다(별도 캐시 없음). */
  private throttle(userId: string, now = Date.now()) {
    const recent = (this.calls.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= config.aiRequestsPerMinute) throw new HttpException('AI 질의가 너무 잦다. 잠시 후 다시 시도하라', HttpStatus.TOO_MANY_REQUESTS);
    this.calls.set(userId, [...recent, now]);
    if (this.calls.size > 1000) for (const [id, ts] of this.calls) if (ts.every((t) => now - t >= 60_000)) this.calls.delete(id);
  }

  /** 스트리밍을 시작하기 전에 검사한다. 통과하면 chat()을 호출해도 된다. */
  async prepare(user: AuthUser, body: ChatBody): Promise<LlmClient> {
    if (!canQueryAi(user.role)) throw new ForbiddenException('Client는 AI 질의를 할 수 없다');
    if (!this.llm) throw new ServiceUnavailableException('AI가 설정되지 않았다');
    if (body.eventId) {
      const eventId = body.eventId;
      const visible = await withContext(this.pool, user, (db) => getEvent(db, eventId));
      if (!visible) throw new ForbiddenException('행사를 찾을 수 없거나 볼 수 없다');
    }
    this.throttle(user.userId);
    return this.llm;
  }

  async chat(user: AuthUser, body: ChatBody, llm: LlmClient, send: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
    const started = Date.now();
    const sources = new Map<string, Pick<SearchHitDto, 'docId' | 'title' | 'heading' | 'snippet'>>();
    const messages: ChatMsg[] = [
      { role: 'system', content: systemPrompt({ today: new Date().toISOString().slice(0, 10), eventId: body.eventId }) },
      ...body.messages,
    ];
    const handlers = this.handlers(user, sources, send);
    let result: Awaited<ReturnType<typeof runAgent>> | undefined;
    let failure: string | null = null;
    try {
      result = await runAgent({
        llm,
        messages,
        handlers,
        signal,
        onText: (delta) => send({ type: 'text', delta }),
        onTool: (t) => send({ type: 'tool', name: t.name, ok: t.ok }),
      });
      if (sources.size) send({ type: 'sources', sources: [...sources.values()] });
      send({ type: 'done' });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      console.error(`[ai] 답변 생성 실패 (model=${llm.model}): ${failure}`);
      send({ type: 'error', message: '답변을 만들지 못했다. 잠시 후 다시 시도하라' });
    }
    await this.log(user, body.eventId ?? null, llm.model, [...messages, ...(result?.messages ?? [])], result, started, failure);
  }

  private async log(user: AuthUser, eventId: string | null, model: string, transcript: ChatMsg[], result: Awaited<ReturnType<typeof runAgent>> | undefined, started: number, error: string | null) {
    const clip = (m: ChatMsg) => ({ ...m, ...(typeof m.content === 'string' && m.content.length > LOG_CONTENT_CHARS ? { content: `${m.content.slice(0, LOG_CONTENT_CHARS)}…` } : {}) });
    try {
      await withContext(this.pool, user, (db) =>
        logAiCall(db, {
          userId: user.userId, eventId, model, messages: transcript.map(clip), toolCalls: result?.toolLog ?? [],
          promptTokens: result?.promptTokens ?? null, completionTokens: result?.completionTokens ?? null, latencyMs: Date.now() - started, error,
        }),
      );
    } catch {
      // 로그 실패가 사용자 응답을 막지 않는다.
    }
  }

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn);
  }

  private handlers(user: AuthUser, sources: Map<string, Pick<SearchHitDto, 'docId' | 'title' | 'heading' | 'snippet'>>, send: (e: ChatEvent) => void): ToolHandlers {
    const propose = async <K extends keyof typeof PROPOSAL_PAYLOADS>(kind: K, eventId: string, summary: string, payload: unknown) => {
      const row = await this.run(user, (db) => insertProposal(db, user.userId, { eventId, kind, summary, payload: PROPOSAL_PAYLOADS[kind].parse(payload) }));
      send({ type: 'proposal', proposal: proposalDto.parse(row) });
      return { proposalId: row.id, status: 'pending' as const, note: PROPOSAL_NOTE };
    };
    const tools: { [K in AgentToolName]: ToolHandlers[K] } = {
      query_events: async (input) => {
        const rows = await this.run(user, (db) => listEvents(db, input));
        return { events: rows.slice(0, 50).map((e) => ({ id: e.id, name: e.name, startDate: e.startDate, endDate: e.endDate, place: e.place, status: e.status, clientId: e.clientId })) };
      },
      query_tasks: async ({ eventId, ...filter }) => {
        const rows = await this.run(user, (db) => listItems(db, eventId, filter));
        return { items: rows.slice(0, 200).map((i) => ({ id: i.id, kind: i.kind, parentId: i.parentId, title: i.title, status: i.status, startsOn: i.startsOn, dueOn: i.dueOn, assigneeId: i.assigneeId })) };
      },
      search_wiki: async ({ query, eventId, limit }) => {
        const hits = await this.run(user, (db) => searchKnowledge(db, { q: query, eventId, limit: limit ?? SEARCH_LIMIT_DEFAULT }, this.embedder));
        for (const h of hits) sources.set(h.docId, { docId: h.docId, title: h.title, heading: h.heading, snippet: h.snippet });
        return { hits: hits.map((h) => ({ chunkId: h.chunkId, docId: h.docId, title: h.title, heading: h.heading, snippet: h.snippet, score: h.score })) };
      },
      read_wiki_page: async ({ docId }) => {
        const page = await this.run(user, (db) => getDocPage(db, docId));
        if (!page) throw new ToolError('문서를 찾을 수 없거나 볼 수 없다');
        sources.set(page.id, { docId: page.id, title: page.title, heading: '', snippet: page.bodyMd.slice(0, 160) });
        return { docId: page.id, title: page.title, version: page.version, bodyMd: page.bodyMd.slice(0, MAX_PAGE_CHARS) };
      },
      propose_task_drafts: async ({ eventId, summary, drafts }) => {
        await this.run(user, async (db) => {
          if (!(await getEvent(db, eventId))) throw new ToolError('행사를 찾을 수 없다');
          const parents = new Map<string, Awaited<ReturnType<typeof getItem>>>();
          for (const id of new Set(drafts.map((d) => d.parentId))) parents.set(id, await getItem(db, id));
          for (const d of drafts) {
            const parent = parents.get(d.parentId);
            if (!parent || parent.eventId !== eventId) throw new ToolError(`상위 항목을 이 행사에서 찾을 수 없다: ${d.parentId}`);
            if (parent.kind !== PARENT_KIND[d.kind]) throw new ToolError(`${d.kind}의 상위는 ${PARENT_KIND[d.kind]}이어야 한다`);
          }
        });
        return propose('task_drafts', eventId, summary, { drafts });
      },
      propose_notification: async ({ eventId, summary, ...payload }) => {
        if (!(await this.run(user, (db) => getEvent(db, eventId)))) throw new ToolError('행사를 찾을 수 없다');
        return propose('notification', eventId, summary, payload);
      },
      propose_wiki_edit: async ({ summary, ...payload }) => {
        const doc = await this.run(user, (db) => getDocPage(db, payload.docId));
        if (!doc) throw new ToolError('문서를 찾을 수 없거나 볼 수 없다');
        if (doc.version !== payload.baseVersion) throw new ToolError(`문서가 바뀌었다. read_wiki_page로 다시 읽어라 (현재 version ${doc.version})`);
        return propose('wiki_edit', doc.eventId, summary, payload);
      },
    };
    return tools as ToolHandlers;
  }
}
