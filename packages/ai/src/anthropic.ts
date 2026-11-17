import { fetchWithRetry } from './retry';
import type { ChatMsg, LlmChunk, LlmClient, ToolCall, ToolSpec } from './llm';

export type AnthropicCompatOptions = { baseUrl: string; apiKey: string; model: string; fetch?: typeof fetch; temperature?: number; maxTokens?: number };

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown } | { type: 'tool_result'; tool_use_id: string; content: string };
type WireMsg = { role: 'user' | 'assistant'; content: string | Block[] };

const parseInput = (raw: string): unknown => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/** system은 별도 필드로, 연속한 tool 결과는 한 user 메시지의 tool_result 블록으로 묶는다. */
function toWire(messages: readonly ChatMsg[]): { system: string; messages: WireMsg[] } {
  const out: WireMsg[] = [];
  const system: string[] = [];
  for (const m of messages) {
    if (m.role === 'system') system.push(m.content);
    else if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: parseInput(c.arguments) });
      out.push({ role: 'assistant', content: blocks.length ? blocks : '' });
    } else if (m.role === 'tool') {
      const result: Block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
      const last = out.at(-1);
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) last.content.push(result);
      else out.push({ role: 'user', content: [result] });
    }
  }
  return { system: system.join('\n\n'), messages: out };
}

/** Anthropic Messages 호환 스트리밍 어댑터 (예: z.ai `/api/anthropic`). API 키는 서버 런타임에서만 주입한다. */
export function anthropicCompatible({ baseUrl, apiKey, model, fetch: doFetch = fetch, temperature = 0.2, maxTokens = 4096 }: AnthropicCompatOptions): LlmClient {
  return {
    model,
    async *stream({ messages, tools, signal }) {
      const wire = toWire(messages);
      const res = await fetchWithRetry(doFetch, `${baseUrl.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          stream: true,
          max_tokens: maxTokens,
          temperature,
          ...(wire.system ? { system: wire.system } : {}),
          messages: wire.messages,
          ...(tools.length ? { tools: tools.map((t: ToolSpec) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
        }),
        signal,
      });
      if (!res.ok || !res.body) throw new Error(`LLM 요청 실패 (HTTP ${res.status})`);

      const pending = new Map<number, ToolCall>();
      let promptTokens = 0;
      let completionTokens = 0;
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
          let ev: StreamEvent;
          try {
            ev = JSON.parse(line.slice(5).trim()) as StreamEvent;
          } catch {
            continue;
          }
          if (ev.type === 'message_start') promptTokens = ev.message?.usage?.input_tokens ?? promptTokens;
          else if (ev.type === 'message_delta') completionTokens = ev.usage?.output_tokens ?? completionTokens;
          else if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use' && ev.index !== undefined) {
            pending.set(ev.index, { id: ev.content_block.id ?? '', name: ev.content_block.name ?? '', arguments: '' });
          } else if (ev.type === 'content_block_delta') {
            if (ev.delta?.type === 'text_delta' && ev.delta.text) yield { type: 'text', delta: ev.delta.text } satisfies LlmChunk;
            if (ev.delta?.type === 'input_json_delta' && ev.index !== undefined) {
              const cur = pending.get(ev.index);
              if (cur) cur.arguments += ev.delta.partial_json ?? '';
            }
          }
        }
      }
      if (promptTokens || completionTokens) yield { type: 'usage', promptTokens, completionTokens };
      if (pending.size) yield { type: 'tool_calls', calls: [...pending.entries()].sort(([a], [b]) => a - b).map(([, c], i) => ({ ...c, id: c.id || `call_${i}`, arguments: c.arguments || '{}' })) };
    },
  };
}

type StreamEvent = {
  type: string;
  index?: number;
  message?: { usage?: { input_tokens?: number } };
  usage?: { output_tokens?: number };
  content_block?: { type: string; id?: string; name?: string };
  delta?: { type: string; text?: string; partial_json?: string };
};
