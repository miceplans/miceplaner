import { describe, expect, it } from 'vitest';
import { toChatMessages } from './chat-history';

describe('toChatMessages', () => {
  it('비었거나 공백뿐인 답변은 다음 질문에 싣지 않는다', () => {
    expect(
      toChatMessages([
        { role: 'user', content: '첫 질문' },
        { role: 'assistant', content: '\n\n ' },
        { role: 'assistant', content: '' },
        { role: 'user', content: ' 둘째 질문 ' },
      ]),
    ).toEqual([
      { role: 'user', content: '첫 질문' },
      { role: 'user', content: '둘째 질문' },
    ]);
  });

  it('긴 답변은 8,000자로 자르고 최근 40개만 보낸다', () => {
    const turns = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? ('assistant' as const) : ('user' as const), content: `${i}`.padEnd(9_000, 'x') }));
    const out = toChatMessages(turns);
    expect(out).toHaveLength(40);
    expect(out.every((m) => m.content.length <= 8_000)).toBe(true);
    expect(out.at(-1)!.content.startsWith('49')).toBe(true);
  });
});
