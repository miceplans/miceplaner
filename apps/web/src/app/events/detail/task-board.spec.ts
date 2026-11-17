import { describe, expect, it } from 'vitest';
import type { EventItemDto } from '@miceplans/contracts';
import { groupTasks, taskMeta } from './task-board';

const item = (over: Partial<EventItemDto>): EventItemDto => ({
  id: crypto.randomUUID(),
  eventId: '00000000-0000-0000-0000-000000000001',
  kind: 'task',
  parentId: '00000000-0000-0000-0000-000000000002',
  title: 't',
  description: '',
  part: null,
  status: '할 일',
  startsOn: null,
  dueOn: null,
  assigneeId: null,
  clientVisible: false,
  version: 1,
  createdBy: '00000000-0000-0000-0000-000000000003',
  completedAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

describe('groupTasks', () => {
  it('상태를 열로 묶고 Program·Subtask·취소는 제외한다', () => {
    const g = groupTasks([
      item({ title: 'a', status: '할 일' }),
      item({ title: 'b', status: '진행 중' }),
      item({ title: 'c', status: '검토 대기' }),
      item({ title: 'd', status: '보류' }),
      item({ title: 'e', status: '완료' }),
      item({ title: 'x', status: '취소' }),
      item({ title: 'p', kind: 'program', parentId: null }),
      item({ title: 's', kind: 'subtask' }),
    ]);
    expect(g.진행.map((t) => t.title)).toEqual(['a', 'b']);
    expect(g['검토 대기'].map((t) => t.title)).toEqual(['c']);
    expect(g.보류.map((t) => t.title)).toEqual(['d']);
    expect(g.완료.map((t) => t.title)).toEqual(['e']);
  });

  it('마감일이 이른 순, 마감일 없는 항목은 뒤로 정렬한다', () => {
    const g = groupTasks([item({ title: 'none' }), item({ title: 'late', dueOn: '2026-12-01' }), item({ title: 'soon', dueOn: '2026-11-20' })]);
    expect(g.진행.map((t) => t.title)).toEqual(['soon', 'late', 'none']);
  });

  it('완료 열은 최근 완료 순이다', () => {
    const g = groupTasks([
      item({ title: 'old', status: '완료', completedAt: '2026-11-02T00:00:00.000Z' }),
      item({ title: 'new', status: '완료', completedAt: '2026-11-10T00:00:00.000Z' }),
    ]);
    expect(g.완료.map((t) => t.title)).toEqual(['new', 'old']);
  });
});

describe('taskMeta', () => {
  it('완료는 완료일, 나머지는 마감일을 보여 준다', () => {
    expect(taskMeta(item({ status: '완료', completedAt: '2026-11-05T09:00:00.000Z' }))).toBe('완료 11/5');
    expect(taskMeta(item({ dueOn: '2026-11-20' }))).toBe('마감 11/20');
    expect(taskMeta(item({}))).toBe('마감일 없음');
  });
});
