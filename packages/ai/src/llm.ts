export type ToolCall = { id: string; name: string; arguments: string };

export type ChatMsg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export type LlmChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'usage'; promptTokens: number; completionTokens: number };

/** 모델 교체를 가능하게 하는 어댑터 경계 (ADR). 구현은 GLM 등 OpenAI 호환 API 하나다. */
export interface LlmClient {
  readonly model: string;
  stream(req: { messages: readonly ChatMsg[]; tools: readonly ToolSpec[]; signal?: AbortSignal }): AsyncIterable<LlmChunk>;
}

export type OpenAiCompatOptions = { baseUrl: string; apiKey: string; model: string; fetch?: typeof fetch; temperature?: number };

const toWire = (m: ChatMsg) => {
  if (m.role === 'assistant') {
    return {
      role: 'assistant',
      content: m.content,
      ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) } : {}),
    };
  }
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
  return m;
};

/** OpenAI Chat Completions 호환 스트리밍 어댑터. API 키는 서버 런타임에서만 주입한다. */
export function openAiCompatible({ baseUrl, apiKey, model, fetch: doFetch = fetch, temperature = 0.2 }: OpenAiCompatOptions): LlmClient {
  return {
    model,
    async *stream({ messages, tools, signal }) {
      const res = await doFetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          stream: true,
          stream_options: { include_usage: true },
          temperature,
          messages: messages.map(toWire),
          ...(tools.length ? { tools: tools.map((t) => ({ type: 'function', function: t })) } : {}),
        }),
        signal,
      });
      if (!res.ok || !res.body) throw new Error(`LLM 요청 실패 (HTTP ${res.status})`);

      const pending = new Map<number, ToolCall>();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let json: ChatCompletionChunk;
          try {
            json = JSON.parse(data) as ChatCompletionChunk;
          } catch {
            continue;
          }
          if (json.usage) yield { type: 'usage', promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0 };
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) yield { type: 'text', delta: delta.content };
          for (const tc of delta?.tool_calls ?? []) {
            const cur = pending.get(tc.index) ?? { id: '', name: '', arguments: '' };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name += tc.function.name;
            if (tc.function?.arguments) cur.arguments += tc.function.arguments;
            pending.set(tc.index, cur);
          }
        }
      }
      if (pending.size) yield { type: 'tool_calls', calls: [...pending.entries()].sort(([a], [b]) => a - b).map(([, c], i) => ({ ...c, id: c.id || `call_${i}` })) };
    },
  };
}

type ChatCompletionChunk = {
  choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};
