import { describe, expect, it } from 'vitest';
import { daysUntil, ddayLabel, eventDayParts, sortEvents, upcomingPrograms } from './portal-data';

const now = new Date(2026, 10, 20, 15, 0);
const event = (eventId: string, startDate: string, endDate = startDate) => ({ eventId, name: eventId, startDate, endDate, place: '서울' });
const program = (programId: string, startsOn: string | null, dueOn: string | null) => ({ eventId: 'e', programId, title: programId, startsOn, dueOn });

describe('Client 포털 표시 데이터', () => {
  it('D-day를 계산한다', () => {
    expect(daysUntil('2026-11-23', now)).toBe(3);
    expect(ddayLabel('2026-11-23', now)).toBe('D-3');
    expect(ddayLabel('2026-11-20', now)).toBe('D-DAY');
    expect(ddayLabel('2026-11-18', now)).toBe('D+2');
  });
  it('행사 날짜 조각을 만든다', () => {
    expect(eventDayParts(event('a', '2026-03-05'))).toEqual({ day: '5', month: '3월' });
  });
  it('지난 행사는 뒤로, 예정 행사는 가까운 순으로 정렬한다', () => {
    const sorted = sortEvents([event('past', '2026-01-01'), event('later', '2026-12-01'), event('soon', '2026-11-21'), event('old', '2025-01-01')], now);
    expect(sorted.map((e) => e.eventId)).toEqual(['soon', 'later', 'past', 'old']);
  });
  it('오늘 이후 Program만 마감 우선으로 가까운 순으로 돌려준다', () => {
    const list = upcomingPrograms([program('past', null, '2026-11-01'), program('b', '2026-12-01', null), program('a', '2026-11-01', '2026-11-25'), program('none', null, null)], now);
    expect(list.map((e) => e.program.programId)).toEqual(['a', 'b']);
  });
});
