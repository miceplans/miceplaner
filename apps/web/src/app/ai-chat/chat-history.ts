import type { ChatBody } from '@miceplans/contracts';

type Message = ChatBody['messages'][number];

/** 계약(chatBody)의 상한. */
const MAX_MESSAGES = 40;
const MAX_CONTENT = 8_000;

/**
 * 서버로 보낼 대화. 답을 못 받아 비었거나 공백뿐인 턴은 빼고, 긴 답변은 상한에 맞춰 자른다.
 * 하나라도 계약에 어긋나면 그 대화의 모든 질문이 400으로 막히기 때문이다.
 */
export function toChatMessages(turns: readonly Message[]): Message[] {
  return turns
    .map(({ role, content }) => ({ role, content: content.trim().slice(0, MAX_CONTENT) }))
    .filter((m) => m.content.trim() !== '')
    .slice(-MAX_MESSAGES);
}
