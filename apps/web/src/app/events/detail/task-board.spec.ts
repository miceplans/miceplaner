import { describe, expect, it } from 'vitest';
import type { EventItemDto } from '@miceplans/contracts';
import { buildBoardItems, groupBoardItems, groupTasks, taskMeta } from './task-board';
import type { CheckItem } from './event-checklist';
import type { RequestRow } from './event-products';

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

describe('행사 상세의 통합 칸반', () => {
  it('스케줄 아래 할 일과 하위 할 일을 상태별 열에 포함한다', () => {
    const schedules: CheckItem[] = [{
      id: 'schedule', title: '운영', done: false, children: [
        { id: 'doing', title: '진행 업무', done: false },
        { id: 'review', title: '검토 업무', done: false, workflowStatus: '검토 대기' },
        { id: 'hold', title: '보류 업무', done: false, workflowStatus: '보류' },
        { id: 'done', title: '완료 업무', done: true, completedAt: 10 },
      ],
    }];
    const groups = groupBoardItems(buildBoardItems([], schedules));
    expect(groups.진행.map((x) => x.title)).toEqual(['진행 업무']);
    expect(groups['검토 대기'].map((x) => x.title)).toEqual(['검토 업무']);
    expect(groups.보류.map((x) => x.title)).toEqual(['보류 업무']);
    expect(groups.완료.map((x) => x.title)).toEqual(['완료 업무']);
  });

  it('제작물을 승인 흐름에 맞는 칸반 열에 포함한다', () => {
    const base: RequestRow = { id: 'p', name: '배너', part: '디자인', due: '', size: '', qty: '', material: '', vendor: '', contact: '', note: '', negotiating: false, status: 'draft' };
    const products = [
      base,
      { ...base, id: 'review', name: '리플렛', status: 'pending' as const },
      { ...base, id: 'done', name: '명찰', status: 'success' as const },
      { ...base, id: 'hold', name: '현수막', status: 'reject' as const },
    ];
    const groups = groupBoardItems(buildBoardItems([], [], products));
    expect(groups.진행[0]?.source).toBe('제작물');
    expect(groups['검토 대기'][0]?.title).toBe('리플렛');
    expect(groups.완료[0]?.title).toBe('명찰');
    expect(groups.보류[0]?.title).toBe('현수막');
  });
});
