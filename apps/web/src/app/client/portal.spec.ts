import { describe, expect, it } from 'vitest';
import type { PortalEventDto, PortalProgramDto } from '@miceplans/contracts/portal';
import {
  calendarWeeks,
  chipsByDay,
  daysUntil,
  ddayLabel,
  eventState,
  formatDay,
  formatMonth,
  formatMonthDay,
  formatPeriod,
  formatPeriodLong,
  gaugeFill,
  inclusiveDays,
  nearestEvent,
  programState,
  eventsInMonth,
  eventWeekBars,
  shortRange,
  sortPrograms,
  stepWindowStart,
  todayIso,
} from './portal';

const T = '2026-11-18';

const event = (startDate: string, endDate: string, name = '행사'): PortalEventDto => ({
  eventId: 'e1',
  name,
  startDate,
  endDate,
  place: '코엑스',
});

const program = (programId: string, title: string, startsOn: string | null, dueOn: string | null, eventId = 'e1'): PortalProgramDto => ({
  eventId,
  programId,
  title,
  startsOn,
  dueOn,
});

describe('todayIso', () => {
  it('로컬 날짜를 YYYY-MM-DD로 만든다', () => {
    expect(todayIso(new Date(2026, 10, 18, 23, 59, 59))).toBe('2026-11-18');
  });
});

describe('eventState', () => {
  it('오늘이 기간 안이면 진행중이다', () => {
    expect(eventState('2026-11-01', '2026-11-30', T)).toBe('진행중');
  });

  it('시작 전이면 예정이다', () => {
    expect(eventState('2026-12-01', '2026-12-02', T)).toBe('예정');
  });

  it('종료 후면 완료다', () => {
    expect(eventState('2026-11-01', '2026-11-17', T)).toBe('완료');
  });
});

describe('programState', () => {
  it('시작일·마감일 범위로 상태를 정한다', () => {
    expect(programState('2026-11-20', '2026-11-25', T)).toBe('예정');
    expect(programState('2026-11-01', '2026-11-30', T)).toBe('진행중');
    expect(programState('2026-11-01', '2026-11-17', T)).toBe('완료');
    expect(programState('2026-11-01', '2026-11-18', T)).toBe('진행중');
  });

  it('한쪽 날짜만 있으면 그 날 기준으로 정한다', () => {
    expect(programState(null, '2026-11-17', T)).toBe('완료');
    expect(programState('2026-11-18', null, T)).toBe('진행중');
    expect(programState('2026-11-19', null, T)).toBe('예정');
  });

  it('날짜가 모두 비어 있으면 null이다', () => {
    expect(programState(null, null, T)).toBeNull();
  });
});

describe('ddayLabel', () => {
  it('시작일까지 남은 일수로 D-day를 만든다', () => {
    expect(ddayLabel('2026-11-25', '2026-11-26', T)).toBe('D-7');
    expect(ddayLabel('2026-11-19', '2026-11-20', T)).toBe('D-1');
  });

  it('진행중과 완료를 구분한다', () => {
    expect(ddayLabel('2026-11-01', '2026-11-30', T)).toBe('진행중');
    expect(ddayLabel('2026-10-01', '2026-10-31', T)).toBe('완료');
  });
});

describe('daysUntil', () => {
  it('달을 넘겨도 실제 일수를 센다', () => {
    expect(daysUntil('2026-12-22', '2026-11-25')).toBe(27);
    expect(daysUntil('2026-03-01', '2026-02-28')).toBe(1);
  });
});

describe('날짜 표시', () => {
  it('일·월·전체 날짜 형식', () => {
    expect(formatDay('2026-11-18')).toBe('18');
    expect(formatMonth('2026-11-18')).toBe('11월');
  });

  it('Figma 목록·상세 기간 형식', () => {
    expect(formatPeriod('2026-03-13', '2026-03-16')).toBe('03.13 – 03.16');
    expect(formatPeriod('2026-04-18', '2026-04-18')).toBe('04.18');
    expect(formatPeriod('2026-12-30', '2027-01-02')).toBe('2026.12.30 – 2027.01.02');
    expect(formatPeriodLong('2025-03-13', '2025-03-16')).toBe('2025. 03. 13 – 03. 16');
    expect(formatPeriodLong('2025-03-13', '2025-03-13')).toBe('2025. 03. 13');
    expect(formatPeriodLong('2025-12-30', '2026-01-02')).toBe('2025. 12. 30 – 2026. 01. 02');
    expect(formatMonthDay('2026-03-10')).toBe('3/10');
  });

  it('양끝 포함 일수를 센다', () => {
    expect(inclusiveDays('2026-11-18', '2026-11-20')).toBe(3);
    expect(inclusiveDays('2026-11-18', '2026-11-18')).toBe(1);
    expect(inclusiveDays('2026-11-30', '2026-12-03')).toBe(4);
  });
});

describe('stepWindowStart', () => {
  it('현재 단계와 직전 단계가 보이게 구간을 고른다', () => {
    expect(stepWindowStart([true, false, false], 5)).toBe(0);
    expect(stepWindowStart([true, true, true, false, false, false, false, false], 5)).toBe(2);
    expect(stepWindowStart([true, true, true, true, true, true, true], 5)).toBe(2);
    expect(stepWindowStart([], 5)).toBe(0);
  });
});

describe('gaugeFill', () => {
  it('비율을 반 칸 단위로 채운다', () => {
    expect(gaugeFill(0, 4)).toEqual([0, 0, 0, 0]);
    expect(gaugeFill(0.5, 4)).toEqual([1, 1, 0, 0]);
    expect(gaugeFill(0.4, 4)).toEqual([1, 0.5, 0, 0]);
    expect(gaugeFill(1, 4)).toEqual([1, 1, 1, 1]);
  });
});

describe('sortPrograms', () => {
  it('시작일 오름차순, 같은 날이면 제목 순이다', () => {
    const sorted = sortPrograms([
      program('p3', '폐막', '2026-11-20', '2026-11-20'),
      program('p1', '개막', '2026-11-18', null),
      program('p2', '세미나', '2026-11-18', '2026-11-18'),
    ]);
    expect(sorted.map((p) => p.title)).toEqual(['개막', '세미나', '폐막']);
  });
});

describe('nearestEvent', () => {
  it('진행중 행사를 먼저 고르고 시작일이 빠른 쪽을 택한다', () => {
    const events = [event('2026-11-20', '2026-11-21', '뒤 예정'), event('2026-11-19', '2026-11-22', '앞 예정'), event('2026-11-01', '2026-11-30', '진행중')];
    expect(nearestEvent(events, T)?.name).toBe('진행중');
  });

  it('진행중이 없으면 가까운 예정 행사를 택한다', () => {
    const events = [event('2026-12-20', '2026-12-21', '뒤'), event('2026-11-25', '2026-11-26', '앞')];
    expect(nearestEvent(events, T)?.name).toBe('앞');
  });

  it('빈 목록이거나 모두 완료면 null이다', () => {
    expect(nearestEvent([], T)).toBeNull();
    expect(nearestEvent([event('2026-10-01', '2026-10-31')], T)).toBeNull();
  });
});

describe('calendarWeeks', () => {
  it('2026년 11월은 1일이 일요일이라 첫 주가 꽉 찬다', () => {
    const weeks = calendarWeeks(2026, 11);
    expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weeks.at(-1)).toHaveLength(7);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('월 시작이 중간이면 앞에 빈 칸을 둔다', () => {
    // 2026-06-01은 월요일
    expect(calendarWeeks(2026, 6)[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
  });
});

describe('chipsByDay', () => {
  it('시작일~마감일 사이의 모든 날에 칩을 놓는다', () => {
    const chips = chipsByDay([program('p1', '세미나', '2026-11-18', '2026-11-20')], 2026, 11, T);
    expect(chips.get(18)).toEqual([{ programId: 'p1', title: '세미나', state: '진행중' }]);
    expect(chips.get(19)).toHaveLength(1);
    expect(chips.get(20)).toHaveLength(1);
    expect(chips.get(21)).toBeUndefined();
  });

  it('한쪽 날짜만 있으면 그 날 하루만 표시한다', () => {
    const chips = chipsByDay([program('p1', '개막', '2026-11-25', null)], 2026, 11, T);
    expect(chips.get(25)).toHaveLength(1);
    expect(chips.get(24)).toBeUndefined();
  });

  it('이번 달과 겹치는 부분만 표시한다', () => {
    const chips = chipsByDay([program('p1', '행사', '2026-10-28', '2026-11-02')], 2026, 11, T);
    expect(chips.get(1)).toHaveLength(1);
    expect(chips.get(2)).toHaveLength(1);
    expect(chips.get(3)).toBeUndefined();
  });

  it('날짜가 없는 Program은 표시하지 않는다', () => {
    expect(chipsByDay([program('p1', '미정', null, null)], 2026, 11, T).size).toBe(0);
  });
});

const pub = (eventId: string, name: string, startDate: string, endDate: string, color: string | null = null) => ({ eventId, name, startDate, endDate, color });

describe('shortRange', () => {
  it('하루·같은 해·해 넘김을 구분해 짧게 적는다', () => {
    expect(shortRange('2026-11-18', '2026-11-18')).toBe('11.18');
    expect(shortRange('2026-11-18', '2026-11-20')).toBe('11.18 ~ 11.20');
    expect(shortRange('2026-12-30', '2027-01-02')).toBe('2026.12.30 ~ 2027.01.02');
  });
});

describe('eventsInMonth', () => {
  it('월과 겹치는 행사만 시작일 순(같으면 긴 행사 먼저)으로 돌려준다', () => {
    const list = eventsInMonth(
      [pub('x', '10월 행사', '2026-10-01', '2026-10-03'), pub('b', '짧은', '2026-11-05', '2026-11-05'), pub('a', '긴', '2026-11-05', '2026-11-09'), pub('c', '걸침', '2026-10-30', '2026-11-02')],
      2026,
      11,
    );
    expect(list.map((e) => e.eventId)).toEqual(['c', 'a', 'b']);
  });
});

describe('eventWeekBars', () => {
  // 2026년 11월: 1일이 일요일이라 1주 = 1~7일, 2주 = 8~14일 ...
  it('여러 날 행사를 주 행마다 이어진 막대 하나로 나누고, 주를 넘으면 이어짐을 표시한다', () => {
    const weeks = eventWeekBars([pub('a', '박람회', '2026-11-05', '2026-11-10')], 2026, 11, T);
    expect(weeks[0]).toEqual([expect.objectContaining({ eventId: 'a', col: 4, span: 3, lane: 0, continuesBefore: false, continuesAfter: true })]);
    expect(weeks[1]).toEqual([expect.objectContaining({ eventId: 'a', col: 0, span: 3, lane: 0, continuesBefore: true, continuesAfter: false })]);
    expect(weeks[2]).toEqual([]);
  });

  it('지난달에서 이어지는 행사는 1일부터 그리고, 겹치는 행사는 다음 줄로 내린다', () => {
    const weeks = eventWeekBars(
      [pub('c', '걸침', '2026-10-30', '2026-11-02'), pub('d', '겹침', '2026-11-02', '2026-11-03'), pub('e', '뒤', '2026-11-04', '2026-11-04')],
      2026,
      11,
      T,
    );
    expect(weeks[0]).toEqual([
      expect.objectContaining({ eventId: 'c', col: 0, span: 2, lane: 0, continuesBefore: true, state: '완료' }),
      expect.objectContaining({ eventId: 'd', col: 1, span: 2, lane: 1 }),
      expect.objectContaining({ eventId: 'e', col: 3, span: 1, lane: 0 }),
    ]);
  });
});
