import { describe, expect, it } from 'vitest';
import { parseSse } from './api';

describe('parseSse', () => {
  it('완성된 블록만 이벤트로 바꾸고 나머지는 남긴다', () => {
    const { events, rest } = parseSse('event: text\ndata: {"type":"text","delta":"안"}\n\nevent: text\ndata: {"type":"te');
    expect(events).toEqual([{ type: 'text', delta: '안' }]);
    expect(rest).toBe('event: text\ndata: {"type":"te');
  });
  it('깨진 JSON과 data 없는 블록은 건너뛴다', () => {
    const { events } = parseSse('data: {oops\n\n: ping\n\nevent: done\ndata: {"type":"done"}\n\n');
    expect(events).toEqual([{ type: 'done' }]);
  });
});
