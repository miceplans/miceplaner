import { describe, expect, it } from 'vitest';
import { eventIdFrom } from './event-context';

const ID = '3f4ec0d9-ed42-434b-b73d-40c92de07a98';

describe('eventIdFrom', () => {
  it('행사 상세의 id 쿼리를 맥락으로 쓴다', () => {
    expect(eventIdFrom('/events/detail', `?id=${ID}`)).toBe(ID);
    expect(eventIdFrom('/events/detail/', `?tab=tasks&id=${ID}`)).toBe(ID);
  });

  it('행사 상세가 아니거나 id가 uuid가 아니면 맥락을 보내지 않는다', () => {
    expect(eventIdFrom('/events', `?id=${ID}`)).toBeUndefined();
    expect(eventIdFrom('/events/detail', '?id=abc')).toBeUndefined();
    expect(eventIdFrom('/events/detail', '')).toBeUndefined();
  });
});
