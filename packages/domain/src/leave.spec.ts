import { describe, expect, it } from 'vitest';
import { annualUsed, compUsed, isWeekend, leaveDays, weekdaysBetween } from './leave';

describe('leave', () => {
  it('형태별 차감 일수', () => {
    expect([leaveDays('full'), leaveDays('pm-half'), leaveDays('am-quarter')]).toEqual([1, 0.5, 0.25]);
  });
  it('토·일만 주말이다', () => {
    expect(['2026-10-24', '2026-10-25'].map(isWeekend)).toEqual([true, true]);
    expect(['2026-10-23', '2026-10-26'].map(isWeekend)).toEqual([false, false]);
  });
  it('대휴와 일반 휴가를 따로 합산한다', () => {
    const uses = [{ kind: 'full' as const }, { kind: 'am-half' as const }, { kind: 'comp' as const }];
    expect(annualUsed(uses)).toBe(1.5);
    expect(compUsed(uses)).toBe(1);
  });
  it('기간 신청은 평일마다 한 건씩 만든다', () => {
    // 2026-10-23(금) ~ 10-26(월): 주말을 걸러낸다.
    expect(weekdaysBetween('2026-10-23', '2026-10-26')).toEqual(['2026-10-23', '2026-10-26']);
    expect(weekdaysBetween('2026-10-24', '2026-10-25')).toEqual([]);
  });
});
