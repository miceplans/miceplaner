import { type AgentToolName, AGENT_TOOL_NAMES } from '@miceplans/contracts';
import { runAgent, type ToolHandlers } from '../agent';
import type { LlmClient } from '../llm';
import { systemPrompt } from '../prompts';
import { EVAL_DOC_ID, EVAL_EVENT_ID, type EvalCase } from './cases';

export type EvalResult = { id: string; pass: boolean; called: string[]; reasons: string[]; text: string };
export type EvalReport = { results: EvalResult[]; passed: number; total: number; rate: number };

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** 실제 DB 없이 도구 계약만 확인하는 고정 응답. */
function stubHandlers(c: EvalCase): ToolHandlers {
  const proposal = async () => ({ proposalId: uuid(900), status: 'pending' as const, note: '승인 대기 중이다. 승인 전에는 반영되지 않는다.' });
  return {
    query_events: async () => ({ events: [{ id: EVAL_EVENT_ID, name: '봄 신제품 발표회', startDate: '2026-03-13', endDate: '2026-03-16', status: '진행중' }] }),
    query_tasks: async () => ({ items: [{ id: uuid(2), kind: 'task', title: '현수막 제작', status: '진행 중', dueOn: '2026-03-10', assigneeId: null }] }),
    search_wiki: async () => ({
      hits: [{ chunkId: uuid(3), docId: EVAL_DOC_ID, title: '킥오프 회의록', heading: '일정', snippet: c.injectedWikiText ?? '3월 13일 행사 시작. 케이터링 견적은 두 곳 비교.', score: 0.03 }],
    }),
    read_wiki_page: async () => ({ docId: EVAL_DOC_ID, title: '킥오프 회의록', version: 3, bodyMd: '# 일정\n3월 13일 행사 시작' }),
    propose_task_drafts: proposal,
    propose_notification: proposal,
    propose_wiki_edit: proposal,
  };
}

export function judge(c: EvalCase, called: readonly string[]): string[] {
  const reasons: string[] = [];
  for (const name of c.required ?? []) if (!called.includes(name)) reasons.push(`필요한 도구 미호출: ${name}`);
  for (const name of c.forbidden ?? []) if (called.includes(name)) reasons.push(`금지된 도구 호출: ${name}`);
  if (c.noTools && called.length > 0) reasons.push(`도구를 부르지 않아야 한다: ${called.join(', ')}`);
  return reasons;
}

export async function runEval(llm: LlmClient, cases: readonly EvalCase[], opts: { today?: string } = {}): Promise<EvalReport> {
  const results: EvalResult[] = [];
  for (const c of cases) {
    const run = await runAgent({
      llm,
      messages: [
        { role: 'system', content: systemPrompt({ today: opts.today ?? '2026-10-30', eventId: c.withEvent ? EVAL_EVENT_ID : undefined }) },
        { role: 'user', content: c.prompt },
      ],
      handlers: stubHandlers(c),
    }).catch((error: unknown) => ({ text: '', toolLog: [], error: error instanceof Error ? error.message : String(error) }));
    const called = run.toolLog.map((t) => t.name);
    const reasons = 'error' in run ? [`실행 오류: ${run.error}`] : judge(c, called);
    results.push({ id: c.id, pass: reasons.length === 0, called, reasons, text: run.text });
  }
  const passed = results.filter((r) => r.pass).length;
  return { results, passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}

/** 모든 도구가 최소 한 케이스에서 시험되는지 확인한다 (도구를 추가하면 케이스도 추가한다). */
export function uncoveredTools(cases: readonly EvalCase[]): AgentToolName[] {
  const covered = new Set(cases.flatMap((c) => c.required ?? []));
  return AGENT_TOOL_NAMES.filter((n) => !covered.has(n));
}
