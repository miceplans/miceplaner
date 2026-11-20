import { describe, expect, it } from 'vitest';
import { eventIdFrom, flattenEventItems, getEventTab, setEventTab } from './event-context';

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

describe('eventTab', () => {
  it('상세 화면이 기록한 탭을 돌려주고, 떠나면 비운다', () => {
    setEventTab('할 일');
    expect(getEventTab()).toBe('할 일');
    setEventTab(undefined);
    expect(getEventTab()).toBeUndefined();
  });
});

describe('flattenEventItems', () => {
  it('스케줄 → 할 일 → 하위 할 일을 단계·상위·담당자·상태와 함께 평면화한다', () => {
    const items = flattenEventItems([
      { id: 's', title: '사전 준비', done: false, children: [
        { id: 't', title: '연사 섭외', done: false, assignee: '홍길동', date: '2026-11-25', workflowStatus: '검토 대기', children: [
          { id: 'u', title: '메일 발송', done: true },
        ] },
      ] },
    ]);
    expect(items).toEqual([
      { level: 'schedule', title: '사전 준비', assignee: null, status: '진행', date: null, part: null, parent: null },
      { level: 'task', title: '연사 섭외', assignee: '홍길동', status: '검토 대기', date: '2026-11-25', part: null, parent: '사전 준비' },
      { level: 'subtask', title: '메일 발송', assignee: null, status: '완료', date: null, part: null, parent: '연사 섭외' },
    ]);
  });

  it('계약 상한을 넘지 않도록 개수를 자른다', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: `t${i}`, done: false }));
    expect(flattenEventItems(many, 3)).toHaveLength(3);
  });
});
