import { describe, expect, it } from 'vitest';
import { EVENT_COLOR_PALETTE, eventColor, randomEventColor } from './event-color';

describe('행사 대표색', () => {
  it('저장된 색상은 그대로 사용한다', () => {
    expect(eventColor('#123456', 'event-1')).toBe('#123456');
  });

  it('색상이 없는 기존 행사는 ID마다 안정적인 팔레트 색상을 사용한다', () => {
    const color = eventColor(null, 'event-1');
    expect(EVENT_COLOR_PALETTE).toContain(color);
    expect(eventColor(null, 'event-1')).toBe(color);
  });

  it('새 행사 색상은 팔레트 안에서 고른다', () => {
    expect(EVENT_COLOR_PALETTE).toContain(randomEventColor());
  });
});
