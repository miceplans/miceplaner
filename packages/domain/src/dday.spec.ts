import { describe, expect, it } from 'vitest';
import { dDayLabel } from './dday';

const today = new Date(2026, 9, 22);

describe('dDayLabel', () => {
  it('미래 날짜는 D-n', () => expect(dDayLabel(new Date(2026, 10, 5), today)).toBe('D-14'));
  it('당일은 D-Day', () => expect(dDayLabel(new Date(2026, 9, 22, 18), today)).toBe('D-Day'));
  it('지난 날짜는 종료', () => expect(dDayLabel(new Date(2026, 9, 21), today)).toBe('종료'));
});
