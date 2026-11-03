import { z } from 'zod';
import { AGENT_TOOLS, isAgentToolName, type AgentToolName } from '@miceplans/contracts';
import type { ChatMsg, LlmClient, ToolCall, ToolSpec } from './llm';

/** 도구 구현이 던지면 메시지가 모델에 그대로 전달된다. 그 외 예외는 일반 오류로 가린다. */
export class ToolError extends Error {}

export type ToolHandlers = { [K in AgentToolName]: (input: z.infer<(typeof AGENT_TOOLS)[K]['input']>) => Promise<unknown> };

export type ToolLogEntry = { name: string; arguments: string; ok: boolean };
export type AgentResult = { text: string; toolLog: ToolLogEntry[]; promptTokens: number; completionTokens: number; messages: ChatMsg[] };

export type AgentOptions = {
  llm: LlmClient;
  messages: readonly ChatMsg[];
  handlers: ToolHandlers;
  onText?: (delta: string) => void;
  onTool?: (entry: ToolLogEntry) => void;
  maxSteps?: number;
  signal?: AbortSignal;
};

const MAX_RESULT_CHARS = 24_000;

export const toolSpecs: ToolSpec[] = Object.entries(AGENT_TOOLS).map(([name, t]) => ({
  name,
  description: t.description,
  parameters: z.toJSONSchema(t.input, { target: 'draft-7' }) as Record<string, unknown>,
}));

/** 모델이 도구를 부르는 동안 반복하고, 도구 없이 답하면 끝난다. 쓰기 도구가 없으므로 어떤 호출도 데이터를 바꾸지 않는다. */
export async function runAgent({ llm, messages, handlers, onText, onTool, maxSteps = 6, signal }: AgentOptions): Promise<AgentResult> {
  const history: ChatMsg[] = [...messages];
  const toolLog: ToolLogEntry[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let text = '';

  for (let step = 0; step < maxSteps; step++) {
    let stepText = '';
    let calls: ToolCall[] = [];
    for await (const chunk of llm.stream({ messages: history, tools: toolSpecs, signal })) {
      if (chunk.type === 'text') {
        stepText += chunk.delta;
        onText?.(chunk.delta);
      } else if (chunk.type === 'tool_calls') calls = chunk.calls;
      else {
        promptTokens += chunk.promptTokens;
        completionTokens += chunk.completionTokens;
      }
    }
    text += stepText;
    history.push({ role: 'assistant', content: stepText || null, ...(calls.length ? { toolCalls: calls } : {}) });
    if (calls.length === 0) return { text, toolLog, promptTokens, completionTokens, messages: history.slice(messages.length) };

    for (const call of calls) {
      const { ok, content } = await execute(call, handlers);
      const entry = { name: call.name, arguments: call.arguments, ok };
      toolLog.push(entry);
      onTool?.(entry);
      history.push({ role: 'tool', toolCallId: call.id, content });
    }
  }

  const notice = '\n\n(조회 단계 한도에 도달해 여기까지만 답합니다. 질문을 더 좁혀 주세요.)';
  onText?.(notice);
  return { text: text + notice, toolLog, promptTokens, completionTokens, messages: history.slice(messages.length) };
}

async function execute(call: ToolCall, handlers: ToolHandlers): Promise<{ ok: boolean; content: string }> {
  const fail = (error: string) => ({ ok: false, content: JSON.stringify({ error }) });
  if (!isAgentToolName(call.name)) return fail(`알 수 없는 도구: ${call.name}`);
  let args: unknown;
  try {
    args = call.arguments.trim() ? JSON.parse(call.arguments) : {};
  } catch {
    return fail('도구 인자가 올바른 JSON이 아니다');
  }
  const parsed = AGENT_TOOLS[call.name].input.safeParse(args);
  if (!parsed.success) return fail(`인자 오류: ${parsed.error.issues[0]?.path.join('.') ?? ''} ${parsed.error.issues[0]?.message ?? ''}`.trim());
  try {
    const result = await (handlers[call.name] as (input: unknown) => Promise<unknown>)(parsed.data);
    const content = JSON.stringify(result);
    return { ok: true, content: content.length > MAX_RESULT_CHARS ? JSON.stringify({ error: '결과가 너무 길다. 더 좁혀 조회하라', truncated: content.slice(0, 2_000) }) : content };
  } catch (error) {
    return fail(error instanceof ToolError ? error.message : '도구 실행에 실패했다');
  }
}
