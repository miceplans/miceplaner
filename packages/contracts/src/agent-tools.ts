import { z } from 'zod';
import { ITEM_KINDS, ITEM_STATUSES, NOTIFICATION_KINDS, PROPOSAL_KINDS, type ProposalKind } from '@miceplans/domain';
import { isoDate, uuid } from './common';
import { searchHitDto } from './knowledge';

/**
 * AI 에이전트 도구의 입출력 계약 (명세 F-11). 쓰기 도구는 없다: `propose_*`는 제안만 저장하고,
 * 변경은 사람이 승인한 뒤 서버 API가 실행한다. 도구를 추가하면 packages/ai의 평가 케이스도 함께 추가한다.
 */

// ── 제안 payload (ai_proposals.payload) ──────────────────────────────────

export const taskDraft = z.object({
  kind: z.enum(['task', 'subtask']),
  /** task는 Program, subtask는 Task의 id. */
  parentId: uuid,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2_000).default(''),
  dueOn: isoDate.nullable().default(null),
  assigneeId: uuid.nullable().default(null),
});
export const taskDraftsPayload = z.object({ drafts: z.array(taskDraft).min(1).max(20) });
export const notificationPayload = z.object({ recipientId: uuid, itemId: uuid.nullable().default(null), kind: z.enum(NOTIFICATION_KINDS), title: z.string().trim().min(1).max(200) });
export const wikiEditPayload = z.object({ docId: uuid, baseVersion: z.number().int().positive(), bodyMd: z.string().max(200_000) });

export const PROPOSAL_PAYLOADS = { task_drafts: taskDraftsPayload, notification: notificationPayload, wiki_edit: wikiEditPayload } as const satisfies Record<ProposalKind, z.ZodType>;

// ── 도구 입력 ────────────────────────────────────────────────────────────

const summary = z.string().trim().min(1).max(300).describe('사람이 승인 여부를 판단할 한 줄 요약');

export const queryEventsInput = z.object({ year: z.number().int().min(2000).max(2100).optional(), status: z.string().optional(), clientId: uuid.optional() });
export const queryTasksInput = z.object({
  eventId: uuid,
  kind: z.enum(ITEM_KINDS).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  assigneeId: uuid.optional(),
});
export const searchWikiInput = z.object({ query: z.string().trim().min(1).max(200), eventId: uuid.optional(), limit: z.number().int().min(1).max(10).default(5) });
export const readWikiPageInput = z.object({ docId: uuid });
export const proposeTaskDraftsInput = z.object({ eventId: uuid, summary, drafts: taskDraftsPayload.shape.drafts });
export const proposeNotificationInput = z.object({ eventId: uuid, summary, ...notificationPayload.shape });
export const proposeWikiEditInput = z.object({ summary, ...wikiEditPayload.shape });

export const AGENT_TOOLS = {
  query_events: { kind: 'read', description: '행사 목록을 조회한다. 연도·상태·고객사로 거른다.', input: queryEventsInput },
  query_tasks: { kind: 'read', description: '행사의 Program·Task·Subtask를 조회한다. 종류·상태·담당자로 거른다.', input: queryTasksInput },
  search_wiki: { kind: 'read', description: '행사 위키 본문을 검색한다. 결과에는 출처(문서·절)가 포함된다.', input: searchWikiInput },
  read_wiki_page: { kind: 'read', description: '위키 문서 한 건의 전체 본문과 version을 읽는다.', input: readWikiPageInput },
  propose_task_drafts: { kind: 'propose', proposal: 'task_drafts', description: 'Task·Subtask 초안을 제안한다. 승인 전에는 아무것도 만들어지지 않는다.', input: proposeTaskDraftsInput },
  propose_notification: { kind: 'propose', proposal: 'notification', description: '알림을 제안한다. 승인 전에는 발송되지 않는다.', input: proposeNotificationInput },
  propose_wiki_edit: { kind: 'propose', proposal: 'wiki_edit', description: '위키 문서 수정안(수정 후 전체 Markdown 본문)을 제안한다. baseVersion은 read_wiki_page로 읽은 version이다.', input: proposeWikiEditInput },
} as const;

export type AgentToolName = keyof typeof AGENT_TOOLS;
export const AGENT_TOOL_NAMES = Object.keys(AGENT_TOOLS) as AgentToolName[];
export const isAgentToolName = (name: string): name is AgentToolName => Object.hasOwn(AGENT_TOOLS, name);

// ── 도구 출력 (모델에 돌려주는 JSON) ─────────────────────────────────────

export const searchWikiOutput = z.object({ hits: z.array(searchHitDto.omit({ eventId: true, updatedAt: true })) });
export const readWikiPageOutput = z.object({ docId: uuid, title: z.string(), version: z.number().int().positive(), bodyMd: z.string() });
export const proposeOutput = z.object({ proposalId: uuid, status: z.literal('pending'), note: z.string() });

export { PROPOSAL_KINDS };
