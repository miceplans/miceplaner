import { describe, expect, it } from 'vitest';
import { runAgent, ToolError, type ToolHandlers } from './agent';
import { anthropicCompatible } from './anthropic';
import { createLlmClient } from './client';
import { openAiCompatible, type ChatMsg, type LlmChunk, type LlmClient } from './llm';
import { EVAL_CASES } from './eval/cases';
import { judge, runEval, uncoveredTools } from './eval/run';

/** 호출마다 미리 정한 청크를 내보내는 가짜 모델. */
const scripted = (steps: LlmChunk[][], seen: ChatMsg[][] = []): LlmClient => {
  let i = 0;
  return {
    model: 'fake',
    async *stream({ messages }) {
      seen.push([...messages]);
      for (const chunk of steps[i++] ?? [{ type: 'text', delta: '끝' }]) yield chunk;
    },
  };
};
const call = (name: string, args: unknown, id = 'c1'): LlmChunk => ({ type: 'tool_calls', calls: [{ id, name, arguments: JSON.stringify(args) }] });
const handlers = (over: Partial<Record<string, (i: never) => Promise<unknown>>> = {}): ToolHandlers => {
  const ok = async () => ({ ok: true });
  return { query_events: ok, query_tasks: ok, search_wiki: ok, read_wiki_page: ok, propose_task_drafts: ok, propose_notification: ok, propose_wiki_edit: ok, ...over } as ToolHandlers;
};

describe('runAgent', () => {
  it('도구 결과를 모델에 돌려주고 최종 답을 스트리밍한다', async () => {
    const seen: ChatMsg[][] = [];
    const llm = scripted([[call('search_wiki', { query: '견적' })], [{ type: 'text', delta: '찾았어요' }, { type: 'usage', promptTokens: 10, completionTokens: 3 }]], seen);
    const deltas: string[] = [];
    const out = await runAgent({ llm, messages: [{ role: 'user', content: 'q' }], handlers: handlers({ search_wiki: async () => ({ hits: [] }) }), onText: (d) => deltas.push(d) });
    expect(out.text).toBe('찾았어요');
    expect(deltas).toEqual(['찾았어요']);
    expect(out.toolLog).toEqual([{ name: 'search_wiki', arguments: '{"query":"견적"}', ok: true }]);
    expect(out).toMatchObject({ promptTokens: 10, completionTokens: 3 });
    expect(seen[1]!.at(-1)).toEqual({ role: 'tool', toolCallId: 'c1', content: '{"hits":[]}' });
  });
  it('알 수 없는 도구와 잘못된 인자는 모델에게 오류로 돌려주고 핸들러를 부르지 않는다', async () => {
    let called = 0;
    const h = handlers({ search_wiki: async () => { called++; return {}; } });
    const seen: ChatMsg[][] = [];
    await runAgent({ llm: scripted([[call('drop_database', {})], [call('search_wiki', { query: '' })], []], seen), messages: [], handlers: h });
    expect(called).toBe(0);
    expect(seen[1]!.at(-1)).toMatchObject({ role: 'tool' });
    expect((seen[1]!.at(-1) as { content: string }).content).toContain('알 수 없는 도구');
    expect((seen[2]!.at(-1) as { content: string }).content).toContain('인자 오류');
  });
  it('ToolError 메시지만 모델에 전달하고 내부 예외는 가린다', async () => {
    const seen: ChatMsg[][] = [];
    const h = handlers({
      query_events: async () => { throw new ToolError('문서를 찾을 수 없다'); },
      query_tasks: async () => { throw new Error('password=hunter2 at pg'); },
    });
    await runAgent({ llm: scripted([[call('query_events', {})], [call('query_tasks', { eventId: '00000000-0000-4000-8000-000000000001' })], []], seen), messages: [], handlers: h });
    expect((seen[1]!.at(-1) as { content: string }).content).toContain('문서를 찾을 수 없다');
    const leaked = (seen[2]!.at(-1) as { content: string }).content;
    expect(leaked).not.toContain('hunter2');
    expect(leaked).toContain('도구 실행에 실패');
  });
  it('단계 한도를 넘으면 멈춘다', async () => {
    const llm = scripted(Array.from({ length: 10 }, () => [call('query_events', {})]));
    const out = await runAgent({ llm, messages: [], handlers: handlers(), maxSteps: 3 });
    expect(out.toolLog).toHaveLength(3);
    expect(out.text).toContain('한도');
  });
});

describe('openAiCompatible', () => {
  const sse = (...lines: unknown[]) => new Response([...lines.map((l) => `data: ${JSON.stringify(l)}\n\n`), 'data: [DONE]\n\n'].join(''));
  it('텍스트·도구 호출 조각·사용량을 합쳐 낸다', async () => {
    let body: { tools?: unknown[]; messages: unknown[]; stream: boolean } | undefined;
    const fetchFake = (async (_url: unknown, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return sse(
        { choices: [{ delta: { content: '안' } }] },
        { choices: [{ delta: { content: '녕' } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'x', function: { name: 'search_', arguments: '{"que' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'wiki', arguments: 'ry":"a"}' } }] } }] },
        { choices: [], usage: { prompt_tokens: 7, completion_tokens: 2 } },
      );
    }) as unknown as typeof fetch;
    const llm = openAiCompatible({ baseUrl: 'https://llm.test/v1/', apiKey: 'k', model: 'glm', fetch: fetchFake });
    const chunks: LlmChunk[] = [];
    for await (const c of llm.stream({ messages: [{ role: 'assistant', content: null, toolCalls: [{ id: 'p', name: 'query_events', arguments: '{}' }] }, { role: 'tool', toolCallId: 'p', content: '{}' }], tools: [{ name: 't', description: 'd', parameters: {} }] })) chunks.push(c);
    expect(chunks.filter((c) => c.type === 'text').map((c) => (c as { delta: string }).delta).join('')).toBe('안녕');
    expect(chunks).toContainEqual({ type: 'tool_calls', calls: [{ id: 'x', name: 'search_wiki', arguments: '{"query":"a"}' }] });
    expect(chunks).toContainEqual({ type: 'usage', promptTokens: 7, completionTokens: 2 });
    expect(body).toMatchObject({ stream: true, tools: [{ type: 'function', function: { name: 't' } }] });
    expect(JSON.stringify(body!.messages)).toContain('tool_call_id');
  });
  it('HTTP 오류는 응답 본문 없이 상태만 알린다', async () => {
    const llm = openAiCompatible({ baseUrl: 'https://llm.test', apiKey: 'k', model: 'm', fetch: (async () => new Response('secret detail', { status: 401 })) as typeof fetch });
    await expect((async () => { for await (const _ of llm.stream({ messages: [], tools: [] })) void _; })()).rejects.toThrow('HTTP 401');
  });
});

describe('anthropicCompatible', () => {
  const sse = (...events: unknown[]) => new Response(events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join(''));
  it('system 분리, tool 결과 묶기, 도구 호출 조각·사용량을 처리한다', async () => {
    let url = '';
    let headers: Record<string, string> = {};
    let body: { system?: string; messages: { role: string; content: unknown }[]; tools?: unknown[] } | undefined;
    const fetchFake = (async (u: string, init: RequestInit) => {
      url = u;
      headers = init.headers as Record<string, string>;
      body = JSON.parse(init.body as string);
      return sse(
        { type: 'message_start', message: { usage: { input_tokens: 9 } } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '안녕' } },
        { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu1', name: 'search_wiki' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"que' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: 'ry":"a"}' } },
        { type: 'message_delta', usage: { output_tokens: 4 } },
      );
    }) as unknown as typeof fetch;
    const llm = anthropicCompatible({ baseUrl: 'https://llm.test/api/anthropic/', apiKey: 'k', model: 'glm', fetch: fetchFake });
    const chunks: LlmChunk[] = [];
    const messages: ChatMsg[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'q' },
      { role: 'assistant', content: null, toolCalls: [{ id: 'a', name: 'query_events', arguments: '{}' }, { id: 'b', name: 'query_tasks', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'a', content: '1' },
      { role: 'tool', toolCallId: 'b', content: '2' },
    ];
    for await (const c of llm.stream({ messages, tools: [{ name: 't', description: 'd', parameters: { type: 'object' } }] })) chunks.push(c);
    expect(url).toBe('https://llm.test/api/anthropic/v1/messages');
    expect(headers['x-api-key']).toBe('k');
    expect(body!.system).toBe('sys');
    expect(body!.messages).toHaveLength(3);
    expect((body!.messages[2]!.content as unknown[]).length).toBe(2);
    expect(body!.tools).toEqual([{ name: 't', description: 'd', input_schema: { type: 'object' } }]);
    expect(chunks).toContainEqual({ type: 'text', delta: '안녕' });
    expect(chunks).toContainEqual({ type: 'tool_calls', calls: [{ id: 'tu1', name: 'search_wiki', arguments: '{"query":"a"}' }] });
    expect(chunks).toContainEqual({ type: 'usage', promptTokens: 9, completionTokens: 4 });
  });
  it('엔드포인트가 /anthropic이면 Anthropic 어댑터를 고른다', async () => {
    const urls: string[] = [];
    const f = (async (u: string) => { urls.push(u); return new Response('', { status: 500 }); }) as unknown as typeof fetch;
    for (const baseUrl of ['https://x/api/anthropic', 'https://x/v4']) {
      await (async () => { for await (const _ of createLlmClient({ baseUrl, apiKey: 'k', model: 'm', fetch: f }).stream({ messages: [], tools: [] })) void _; })().catch(() => undefined);
    }
    expect(urls).toEqual(['https://x/api/anthropic/v1/messages', 'https://x/v4/chat/completions']);
  });
});

describe('평가 골든 셋 (명세 F-11)', () => {
  it('20~30개이고 id가 유일하며 모든 도구를 시험한다', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(20);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(30);
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(EVAL_CASES.length);
    expect(uncoveredTools(EVAL_CASES)).toEqual([]);
  });
  it('기대대로 부르는 모델은 전부 통과하고 엉뚱한 모델은 걸러낸다', async () => {
    const oracle: LlmClient = {
      model: 'oracle',
      async *stream({ messages }) {
        const last = messages.at(-1)!;
        if (last.role !== 'user') return yield { type: 'text', delta: '완료' };
        const c = EVAL_CASES.find((x) => x.prompt === last.content)!;
        const calls = (c.required ?? []).map((name, i) => ({ id: `c${i}`, name, arguments: JSON.stringify(sampleArgs(name)) }));
        if (calls.length) yield { type: 'tool_calls', calls };
        else yield { type: 'text', delta: '도구 없이 답' };
      },
    };
    const good = await runEval(oracle, EVAL_CASES);
    expect(good.results.filter((r) => !r.pass)).toEqual([]);
    const reckless: LlmClient = { model: 'reckless', async *stream({ messages }) { if (messages.at(-1)!.role === 'user') yield call('propose_notification', sampleArgs('propose_notification')); else yield { type: 'text', delta: 'x' }; } };
    const bad = await runEval(reckless, EVAL_CASES);
    expect(bad.rate).toBeLessThan(0.2);
  });
  it('judge가 필수·금지·무도구 조건을 판정한다', () => {
    expect(judge({ id: 'a', prompt: '', required: ['query_events'] }, [])).toHaveLength(1);
    expect(judge({ id: 'a', prompt: '', forbidden: ['propose_wiki_edit'] }, ['propose_wiki_edit'])).toHaveLength(1);
    expect(judge({ id: 'a', prompt: '', noTools: true }, ['query_events'])).toHaveLength(1);
    expect(judge({ id: 'a', prompt: '', required: ['query_events'] }, ['query_events'])).toEqual([]);
  });
});

const ID = '00000000-0000-4000-8000-000000000001';
function sampleArgs(name: string): unknown {
  switch (name) {
    case 'query_tasks': return { eventId: ID };
    case 'search_wiki': return { query: '견적' };
    case 'read_wiki_page': return { docId: ID };
    case 'propose_task_drafts': return { eventId: ID, summary: 's', drafts: [{ kind: 'task', parentId: ID, title: 't' }] };
    case 'propose_notification': return { eventId: ID, summary: 's', recipientId: ID, kind: 'due_soon', title: 't' };
    case 'propose_wiki_edit': return { summary: 's', docId: ID, baseVersion: 1, bodyMd: 'b' };
    default: return {};
  }
}
