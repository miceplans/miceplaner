import { z } from 'zod';
import { PROPOSAL_KINDS, PROPOSAL_STATUSES } from '@miceplans/domain';
import { isoDateTime, uuid } from './common';
import { searchHitDto } from './knowledge';

export const chatMessage = z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(8_000) });

/** AI 질의. 서버는 클라이언트가 보낸 대화만 쓰고 시스템 프롬프트·도구는 서버가 정한다. */
export const chatBody = z.object({
  /** 지정하면 이 행사를 대화의 기본 맥락으로 쓴다. */
  eventId: uuid.optional(),
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
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ChatEvent = z.infer<typeof chatEvent>;
