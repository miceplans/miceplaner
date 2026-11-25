import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import {
  PROPOSAL_PAYLOADS, proposalDto, type AgentToolName, type ChatBody, type ChatEvent, type SearchHitDto,
} from '@miceplans/contracts';
import { PARENT_KIND, canQueryAi } from '@miceplans/domain';
import { PersonNameMasker, runAgent, systemPrompt, ToolError, type ChatMsg, type LlmClient, type ToolHandlers } from '@miceplans/ai';
import {
  getDocPage, getEvent, getItem, hitRateLimit, insertProposal, listEvents, listItems, listUsers, logAiCall, withContext, type Pool, type PoolClient,
} from '@miceplans/db';
import { AuthUser } from '../common/auth';
import { rateLimitKey } from '../common/rate-limit';
import { config } from '../config';
import { searchKnowledge } from '../knowledge/knowledge.service';
import type { Embedder } from '@miceplans/knowledge/embed';
import { DB_POOL, EMBEDDER, LLM_CLIENT } from '../tokens';

const MAX_PAGE_CHARS = 20_000;
const LOG_CONTENT_CHARS = 4_000;
const SEARCH_LIMIT_DEFAULT = 5;

/** 사용자당 AI 질의 한도의 창 길이(초). */
const AI_RATE_WINDOW_SECONDS = 60;

/** 정해진 마감이나 연결 종료로 signal이 끊기면 작업이 signal을 무시하더라도 바로 거부한다. */
const untilAborted = <T>(work: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) return Promise.reject(signal.reason);
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  return Promise.race([work, aborted]).finally(() => signal.removeEventListener('abort', onAbort));
};

const PROPOSAL_NOTE = '제안이 저장되었다. PM·AM이 승인하기 전에는 아무것도 바뀌지 않는다. 사용자에게 승인이 필요하다고 알려라.';

/** AI 질의 오케스트레이션 (명세 F-11). 도구는 호출한 사용자의 RLS 컨텍스트에서 실행되고, 쓰기 도구는 없다. */
@Injectable()
export class AiService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Optional() @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
    @Optional() @Inject(EMBEDDER) private readonly embedder: Embedder | null = null,
  ) {}

  /** 스트리밍을 시작하기 전에 검사한다. 통과하면 chat()을 호출해도 된다. */
  async prepare(user: AuthUser, body: ChatBody): Promise<LlmClient> {
    if (!canQueryAi(user.role)) throw new ForbiddenException('[403] Client는 AI 질의를 할 수 없습니다.');
    if (!this.llm) throw new ServiceUnavailableException('[503] AI가 설정되지 않았습니다.');
    const eventId = body.eventId;
    // 사용자당 분당 한도. 서버리스 인스턴스마다 메모리가 따로라 카운터는 PostgreSQL에 둔다. 볼 수 없는 행사 질의는 세지 않는다.
    const allowed = await withContext(this.pool, user, async (db) => {
      if (eventId && !(await getEvent(db, eventId))) throw new ForbiddenException('[404] 행사를 찾을 수 없거나 볼 수 없습니다.');
      return hitRateLimit(db, rateLimitKey('ai-chat', 'user', user.userId), AI_RATE_WINDOW_SECONDS, config.aiRequestsPerMinute);
    });
    if (!allowed) throw new HttpException('[429] AI 질의가 너무 잦습니다. 잠시 후 다시 시도해 주세요.', HttpStatus.TOO_MANY_REQUESTS);
    return this.llm;
  }

  /**
   * 답변을 스트리밍한다. 전체 마감(AI_CHAT_DEADLINE_MS)을 넘기면 LLM 호출·재시도 대기를 끊고 error 이벤트로 끝낸다.
   * Vercel 함수 최대 실행 시간에 응답이 중간에 잘리는 대신 클라이언트가 실패를 분명히 받게 하기 위함이다.
   */
  async chat(user: AuthUser, body: ChatBody, llm: LlmClient, send: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
    const started = Date.now();
    const deadline = AbortSignal.timeout(config.aiChatDeadlineMs);
    const stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const sources = new Map<string, Pick<SearchHitDto, 'docId' | 'title' | 'heading' | 'snippet'>>();
    const people = await this.run(user, (db) => listUsers(db));
    const masker = new PersonNameMasker([...people.map((person) => person.name), user.name]);
    const restore = masker.createStreamRestorer();
    const eventId = body.eventId;
    const current = eventId ? await this.run(user, (db) => getEvent(db, eventId)) : undefined;
    const event = current && {
      name: masker.redactText(current.name), startDate: current.startDate, endDate: current.endDate,
      place: current.place ? masker.redactText(current.place) : null, status: current.status,
    };
    const messages: ChatMsg[] = [
      { role: 'system', content: systemPrompt({
        today: new Date().toISOString().slice(0, 10), eventId, event,
        eventTab: eventId ? body.eventTab : undefined,
        eventItems: eventId && body.eventItems ? (masker.redact(body.eventItems) as unknown[]) : undefined,
        me: { id: user.userId, token: masker.redactText(user.name) },
      }) },
      ...body.messages.filter((message) => message.content).map((message) => ({ ...message, content: masker.redactText(message.content) })),
    ];
    const handlers = this.handlers(user, sources, send, masker);
    let result: Awaited<ReturnType<typeof runAgent>> | undefined;
    let failure: string | null = null;
    try {
      result = await untilAborted(runAgent({
        llm,
        messages,
        handlers,
        signal: stop,
        onText: (delta) => {
          const restored = restore.push(delta);
          if (restored) send({ type: 'text', delta: restored });
        },
        onTool: (t) => send({ type: 'tool', name: t.name, ok: t.ok }),
        onRetry: ({ delayMs }) => send({ type: 'status', message: `AI 서버가 혼잡해 ${Math.ceil(delayMs / 1000)}초 뒤 다시 시도합니다…` }),
      }), stop);
      const tail = restore.flush();
      if (tail) send({ type: 'text', delta: tail });
      if (sources.size) send({ type: 'sources', sources: [...sources.values()] });
      send({ type: 'done' });
    } catch (error) {
      if (deadline.aborted) {
        failure = `마감 초과 (${config.aiChatDeadlineMs}ms)`;
        console.error(`[ai] 답변 생성 중단 (model=${llm.model}): ${failure}`);
        send({ type: 'error', message: '[504] 답변 시간이 너무 길어 중단했습니다. 질문을 좁혀 다시 시도해 주세요.' });
      } else if (signal?.aborted) {
        // 사용자가 연결을 끊었다. 보낼 곳이 없으므로 기록만 남긴다.
        failure = '클라이언트 연결 종료';
      } else {
        failure = error instanceof Error ? error.message : String(error);
        console.error(`[ai] 답변 생성 실패 (model=${llm.model}): ${failure}`);
        send({ type: 'error', message: '[500] 답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      }
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

  private handlers(user: AuthUser, sources: Map<string, Pick<SearchHitDto, 'docId' | 'title' | 'heading' | 'snippet'>>, send: (e: ChatEvent) => void, masker: PersonNameMasker): ToolHandlers {
    const propose = async <K extends keyof typeof PROPOSAL_PAYLOADS>(kind: K, eventId: string, summary: string, payload: unknown) => {
      const row = await this.run(user, (db) => insertProposal(db, user.userId, {
        eventId,
        kind,
        summary: masker.restoreText(summary),
        payload: PROPOSAL_PAYLOADS[kind].parse(masker.restore(payload)),
      }));
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
        if (!page) throw new ToolError('[404] 문서를 찾을 수 없거나 볼 수 없습니다.');
        sources.set(page.id, { docId: page.id, title: page.title, heading: '', snippet: page.bodyMd.slice(0, 160) });
        return { docId: page.id, title: page.title, version: page.version, bodyMd: page.bodyMd.slice(0, MAX_PAGE_CHARS) };
      },
      propose_task_drafts: async ({ eventId, summary, drafts }) => {
        await this.run(user, async (db) => {
          if (!(await getEvent(db, eventId))) throw new ToolError('[404] 행사를 찾을 수 없습니다.');
          const parents = new Map<string, Awaited<ReturnType<typeof getItem>>>();
          for (const id of new Set(drafts.map((d) => d.parentId))) parents.set(id, await getItem(db, id));
          for (const d of drafts) {
            const parent = parents.get(d.parentId);
            if (!parent || parent.eventId !== eventId) throw new ToolError(`[404] 상위 항목을 이 행사에서 찾을 수 없습니다: ${d.parentId}.`);
            if (parent.kind !== PARENT_KIND[d.kind]) throw new ToolError(`${d.kind}의 상위는 ${PARENT_KIND[d.kind]}이어야 한다`);
          }
        });
        return propose('task_drafts', eventId, summary, { drafts });
      },
      propose_notification: async ({ eventId, summary, ...payload }) => {
        if (!(await this.run(user, (db) => getEvent(db, eventId)))) throw new ToolError('[404] 행사를 찾을 수 없습니다.');
        return propose('notification', eventId, summary, payload);
      },
      propose_wiki_edit: async ({ summary, ...payload }) => {
        const doc = await this.run(user, (db) => getDocPage(db, payload.docId));
        if (!doc) throw new ToolError('[404] 문서를 찾을 수 없거나 볼 수 없습니다.');
        if (doc.version !== payload.baseVersion) throw new ToolError(`[409] 문서가 바뀌었습니다. read_wiki_page로 다시 읽어 주세요 (현재 version ${doc.version}).`);
        return propose('wiki_edit', doc.eventId, summary, payload);
      },
    };
    return Object.fromEntries(Object.entries(tools).map(([name, handler]) => [
      name,
      async (input: never) => masker.redact(await (handler as (value: never) => Promise<unknown>)(input)),
    ])) as ToolHandlers;
  }
}
