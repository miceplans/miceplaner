import { z } from 'zod';
import { PROPOSAL_KINDS, PROPOSAL_STATUSES } from '@miceplans/domain';
import { isoDateTime, uuid } from './common';
import { searchHitDto } from './knowledge';

/**
 * 질문은 비울 수 없다. 답변은 비어 있어도 받고 서버가 버린다. 답을 못 받은 턴이 대화에 남아 있다는 이유로
 * 이어지는 질문까지 모두 거절하지 않기 위해서다.
 */
export const chatMessage = z
  .object({ role: z.enum(['user', 'assistant']), content: z.string().trim().max(8_000, '[400] 메시지는 8,000자를 넘을 수 없습니다.') })
  .refine((m) => m.role === 'assistant' || m.content.length > 0, { message: '[400] 질문을 입력해 주세요.', path: ['content'] });

/**
 * 행사 상세 화면에 보이는 스케줄·할 일 한 줄. 이 목록은 브라우저(local-first)에만 저장돼 서버 도구로 조회할 수 없어
 * 질문할 때 화면이 함께 보낸다. 모델에는 데이터로만 전달하고 이름은 서버가 가린다.
 */
export const eventPageItem = z.object({
  level: z.enum(['schedule', 'task', 'subtask']),
  title: z.string().max(200),
  /** 담당자 이름. 서버가 비식별 토큰으로 바꾼다. */
  assignee: z.string().max(50).nullable(),
  status: z.string().max(20),
  date: z.string().max(40).nullable(),
  part: z.string().max(20).nullable(),
  parent: z.string().max(200).nullable(),
});
export type EventPageItem = z.infer<typeof eventPageItem>;

/** AI 질의. 서버는 클라이언트가 보낸 대화만 쓰고 시스템 프롬프트·도구는 서버가 정한다. */
export const chatBody = z.object({
  /** 지정하면 이 행사를 대화의 기본 맥락으로 쓴다. */
  eventId: uuid.optional(),
  /** eventId와 함께 쓴다. 사용자가 행사 상세에서 보고 있는 탭 이름(예: '할 일'). 모델에는 데이터로만 전달한다. */
  eventTab: z.string().trim().min(1).max(40).optional(),
  /** eventId와 함께 쓴다. 행사 상세 화면의 스케줄·할 일 스냅샷. */
  eventItems: z.array(eventPageItem).max(300).optional(),
  messages: z.array(chatMessage).min(1).max(40),
});
export type ChatBody = z.infer<typeof chatBody>;

export const proposalKind = z.enum(PROPOSAL_KINDS);
export const proposalStatus = z.enum(PROPOSAL_STATUSES);

export const proposalDto = z.object({
  id: uuid,
  eventId: uuid,
  kind: proposalKind,
  summary: z.string(),
  payload: z.unknown(),
  status: proposalStatus,
  createdBy: uuid,
  createdAt: isoDateTime,
  decidedBy: uuid.nullable(),
  decidedAt: isoDateTime.nullable(),
});
export type ProposalDto = z.infer<typeof proposalDto>;

export const listProposalsQuery = z.object({ status: proposalStatus.optional() });
export type ListProposalsQuery = z.infer<typeof listProposalsQuery>;

/** AI 응답 SSE 이벤트. `event:` 이름이 type이고 `data:`가 JSON이다. */
export const chatEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), delta: z.string() }),
  z.object({ type: z.literal('tool'), name: z.string(), ok: z.boolean() }),
  z.object({ type: z.literal('sources'), sources: z.array(searchHitDto.pick({ docId: true, title: true, heading: true, snippet: true })) }),
  z.object({ type: z.literal('proposal'), proposal: proposalDto }),
  /** 답변 전 대기 상태 안내(예: LLM 과부하 재시도). 답변 본문에는 넣지 않는다. */
  z.object({ type: z.literal('status'), message: z.string() }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ChatEvent = z.infer<typeof chatEvent>;
