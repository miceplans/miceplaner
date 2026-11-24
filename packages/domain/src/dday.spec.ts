import { describe, expect, it } from 'vitest';
import { dDayLabel } from './dday';

const today = new Date(2026, 9, 22);

describe('dDayLabel', () => {
  it('미래 날짜는 D-n', () => expect(dDayLabel(new Date(2026, 10, 5), today)).toBe('D-14'));
  it('당일은 D-Day', () => expect(dDayLabel(new Date(2026, 9, 22, 18), today)).toBe('D-Day'));
  it('지난 날짜는 종료', () => expect(dDayLabel(new Date(2026, 9, 21), today)).toBe('종료'));
  it('시작일이 지났어도 종료일 전이면 진행', () => expect(dDayLabel(new Date(2026, 9, 20), today, new Date(2026, 9, 24))).toBe('진행'));
  it('종료일 당일도 진행', () => expect(dDayLabel(new Date(2026, 9, 20), today, new Date(2026, 9, 22))).toBe('진행'));
  it('종료일이 지나면 종료', () => expect(dDayLabel(new Date(2026, 9, 18), today, new Date(2026, 9, 21))).toBe('종료'));
});
