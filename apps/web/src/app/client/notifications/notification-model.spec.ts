import { describe, expect, it } from 'vitest';
import type { PortalNotificationDto } from '@miceplans/contracts/portal';
import { detailTime, euro, groupNotifications, listTime, notificationMonth, notificationTitle, scheduleChange } from './notification-model';

const make = (patch: Partial<PortalNotificationDto> = {}): PortalNotificationDto => ({
  id: 1, kind: 'schedule_changed', eventId: 'e', eventName: 'AI서밋', programId: 'p', programTitle: '등록 폼',
  beforeStartsOn: null, beforeDueOn: '2025-03-12', afterStartsOn: null, afterDueOn: '2025-03-10', createdAt: '2025-03-06T04:24:00.000Z', readAt: null, ...patch,
});
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (...a: Parameters<typeof at>) => at(...a).toISOString();

describe('euro', () => {
  it('숫자 끝소리에 맞춘다', () => {
    expect(['03.10', '03.13', '03.16', '03.20', '미정'].map(euro)).toEqual(['으로', '으로', '으로', '으로', '으로']);
    expect(['03.11', '03.12', '03.14', '03.15', '03.17', '03.18', '03.19'].map(euro)).toEqual(Array(7).fill('로'));
  });
});

describe('notificationTitle', () => {
  it('마감 변경을 앞당김·미룸으로 적는다', () => {
    expect(notificationTitle(make())).toBe('“등록 폼” 마감이 03.12에서 03.10으로 앞당겨졌어요');
    expect(notificationTitle(make({ beforeDueOn: '2025-03-10', afterDueOn: '2025-03-12' }))).toBe('“등록 폼” 마감이 03.10에서 03.12로 미뤄졌어요');
  });
  it('날짜가 새로 정해지거나 없어진 경우', () => {
    expect(notificationTitle(make({ beforeDueOn: null }))).toBe('“등록 폼” 마감이 03.10으로 정해졌어요');
    expect(notificationTitle(make({ afterDueOn: null }))).toBe('“등록 폼” 마감이 미정으로 바뀌었어요');
  });
  it('시작일만 바뀌면 시작일, 둘 다 바뀌면 일정으로 적는다', () => {
    expect(notificationTitle(make({ beforeStartsOn: '2025-03-01', afterStartsOn: '2025-03-05', afterDueOn: '2025-03-12' }))).toBe('“등록 폼” 시작일이 03.01에서 03.05로 미뤄졌어요');
    expect(notificationTitle(make({ beforeStartsOn: '2025-03-11', afterStartsOn: '2025-03-13', afterDueOn: '2025-03-14' }))).toBe('“등록 폼” 일정이 03.11 – 03.12에서 03.13 – 03.14로 미뤄졌어요');
    expect(scheduleChange(make({ beforeStartsOn: '2025-03-11', afterStartsOn: '2025-03-09', afterDueOn: '2025-03-14' })).verb).toBe('바뀌었어요');
  });
  it('공유 알림', () => {
    expect(notificationTitle(make({ kind: 'program_published' }))).toBe('“등록 폼” 일정이 공유됐어요');
  });
});

describe('scheduleChange 칩', () => {
  it('하루는 요일까지, 없으면 미정', () => {
    expect(scheduleChange(make())).toMatchObject({ beforeChip: '03.12 (수)', afterChip: '03.10 (월)' });
    expect(scheduleChange(make({ afterDueOn: null })).afterChip).toBe('미정');
  });
});

describe('시각', () => {
  const now = at(2025, 3, 6, 14, 0);
  it('목록', () => {
    expect(listTime(iso(2025, 3, 6, 14, 0), now)).toBe('방금 전');
    expect(listTime(iso(2025, 3, 6, 13, 50), now)).toBe('10분 전');
    expect(listTime(iso(2025, 3, 6, 11, 0), now)).toBe('3시간 전');
    expect(listTime(iso(2025, 3, 6, 9, 20), now)).toBe('오전 9:20');
    expect(listTime(iso(2025, 3, 5, 16, 12), now)).toBe('어제 오후 4:12');
    expect(listTime(iso(2025, 3, 3, 16, 12), now)).toBe('3월 3일');
  });
  it('상세', () => {
    expect(detailTime(iso(2025, 3, 6, 13, 24), now)).toBe('오늘 오후 1:24');
    expect(detailTime(iso(2025, 3, 5, 0, 5), now)).toBe('어제 오전 12:05');
    expect(detailTime(iso(2025, 3, 1, 12, 0), now)).toBe('3월 1일 오후 12:00');
  });
});

describe('groupNotifications', () => {
  it('오늘·어제·이번 주·지난주·이전으로 묶고 빈 묶음은 뺀다', () => {
    const now = at(2025, 3, 6); // 목요일
    const days = [[3, 6], [3, 5], [3, 3], [3, 2], [2, 24], [2, 23]] as const;
    const groups = groupNotifications(days.map(([m, d], i) => make({ id: i + 1, createdAt: iso(2025, m, d, 9) })), now);
    expect(groups.map((g) => [g.label, g.items.map((n) => n.id)])).toEqual([['오늘', [1]], ['어제', [2]], ['이번 주', [3]], ['지난주', [4, 5]], ['이전', [6]]]);
    expect(groupNotifications([], now)).toEqual([]);
  });
});

describe('notificationMonth', () => {
  it('변경된 날짜의 달을 고르고 없으면 이번 달', () => {
    expect(notificationMonth(make())).toEqual({ year: 2025, month: 3 });
    expect(notificationMonth(make({ beforeDueOn: null, afterDueOn: null }), at(2026, 11, 25))).toEqual({ year: 2026, month: 11 });
  });
});
