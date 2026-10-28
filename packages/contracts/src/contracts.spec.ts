import { describe, expect, it } from 'vitest';
import { createItemBody, requestLeaveBody, rescheduleItemBody, weekendWorkBody, createEventBody } from './index';

const id = '00000000-0000-4000-8000-000000000001';

describe('createItemBody', () => {
  it('Program은 상위 항목이 없어야 한다', () => {
    expect(createItemBody.safeParse({ kind: 'program', title: '개막식' }).success).toBe(true);
    expect(createItemBody.safeParse({ kind: 'program', parentId: id, title: '개막식' }).success).toBe(false);
  });
  it('Task·Subtask는 상위 항목이 필요하다', () => {
    expect(createItemBody.safeParse({ kind: 'task', title: '인쇄' }).success).toBe(false);
    expect(createItemBody.safeParse({ kind: 'subtask', parentId: id, title: '견적' }).success).toBe(true);
  });
  it('기본값을 채운다', () => {
    expect(createItemBody.parse({ kind: 'program', title: 'a' })).toMatchObject({ status: '할 일', description: '', assigneeId: null });
  });
});

describe('버전 검사 대상', () => {
  it('마감일 변경은 version이 필수다', () => {
    expect(rescheduleItemBody.safeParse({ startsOn: null, dueOn: '2026-03-05' }).success).toBe(false);
    expect(rescheduleItemBody.safeParse({ startsOn: '2026-03-06', dueOn: '2026-03-05', expectedVersion: 1 }).success).toBe(false);
    expect(rescheduleItemBody.safeParse({ startsOn: null, dueOn: '2026-03-05', expectedVersion: 1 }).success).toBe(true);
  });
});

describe('createEventBody', () => {
  it('종료일이 시작일보다 앞서면 거부한다', () => {
    expect(createEventBody.safeParse({ clientId: id, name: 'KIMES', startDate: '2026-03-13', endDate: '2026-03-12' }).success).toBe(false);
  });
});

describe('날짜', () => {
  it('존재하지 않는 날짜를 거부한다', () => {
    expect(createEventBody.safeParse({ clientId: id, name: 'a', startDate: '2026-99-99', endDate: '2026-99-99' }).success).toBe(false);
    expect(createEventBody.safeParse({ clientId: id, name: 'a', startDate: '2026-02-30', endDate: '2026-03-01' }).success).toBe(false);
    expect(createEventBody.safeParse({ clientId: id, name: 'a', startDate: '2026-02-28', endDate: '2026-03-01' }).success).toBe(true);
  });
});

describe('휴가', () => {
  it('주말 신청은 거부한다', () => {
    expect(requestLeaveBody.safeParse({ kind: 'full', startDate: '2026-10-24', endDate: '2026-10-24' }).success).toBe(false);
  });
  it('반차는 하루만 신청할 수 있다', () => {
    expect(requestLeaveBody.safeParse({ kind: 'am-half', startDate: '2026-10-22', endDate: '2026-10-23' }).success).toBe(false);
    expect(requestLeaveBody.safeParse({ kind: 'full', startDate: '2026-10-22', endDate: '2026-10-23' }).success).toBe(true);
  });
  it('주말 근무 체크는 주말 날짜만 받는다', () => {
    expect(weekendWorkBody.safeParse({ date: '2026-10-24', worked: true }).success).toBe(true);
    expect(weekendWorkBody.safeParse({ date: '2026-10-23', worked: true }).success).toBe(false);
  });
});
