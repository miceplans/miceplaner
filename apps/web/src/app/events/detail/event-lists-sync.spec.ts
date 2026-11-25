import { describe, expect, it } from 'vitest';
import type { EventItemDto } from '@miceplans/contracts';
import type { CheckItem } from './event-checklist-model';
import { blockBody, blockFromDto, diffRows, diffTrees, fromMinute, toMinute, treeFromItems, withUuidIds } from './event-lists-sync';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dto = (over: Partial<EventItemDto>): EventItemDto => ({
  id: uid(1), eventId: uid(100), kind: 'program', parentId: null, title: 't', description: '', part: null, status: '할 일',
  startsOn: null, dueOn: null, startMinute: null, endMinute: null, assigneeId: null, clientVisible: false, version: 1,
  createdBy: uid(200), completedAt: null, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...over,
});

describe('시각 변환', () => {
  it('오전 9시 기준 시간과 자정 기준 분을 서로 바꾼다', () => {
    expect(toMinute(0)).toBe(540);
    expect(toMinute(1.5)).toBe(630);
    expect(toMinute(undefined)).toBeNull();
    expect(fromMinute(630)).toBe(1.5);
    expect(fromMinute(null)).toBeUndefined();
  });
});

describe('treeFromItems', () => {
  it('program → task → subtask 트리를 만들고 취소 항목과 그 하위는 뺀다', () => {
    const tree = treeFromItems([
      dto({ id: uid(1), title: '리허설', dueOn: '2026-12-01', startMinute: 600, endMinute: 660 }),
      dto({ id: uid(2), kind: 'task', parentId: uid(1), title: '음향', status: '진행 중', assigneeId: uid(300), createdAt: '2026-11-02T00:00:00.000Z' }),
      dto({ id: uid(3), kind: 'task', parentId: uid(1), title: '조명', status: '완료', createdAt: '2026-11-01T12:00:00.000Z' }),
      dto({ id: uid(4), kind: 'task', parentId: uid(1), title: '취소됨', status: '취소' }),
      dto({ id: uid(5), kind: 'subtask', parentId: uid(4), title: '숨김' }),
    ], (id) => (id === uid(300) ? '김담당' : undefined));
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ title: '리허설', date: '2026-12-01', start: 1, end: 2 });
    expect(tree[0]!.children!.map((c) => [c.title, c.workflowStatus, c.done])).toEqual([['조명', '완료', true], ['음향', '진행', false]]);
    expect(tree[0]!.children![1]).toMatchObject({ assignee: '김담당', owner: '김' });
  });
});

describe('diffTrees', () => {
  const base: CheckItem[] = [{ id: 'p', title: '리허설', done: false, children: [{ id: 't', title: '음향', done: false }] }];

  it('새 항목은 상위부터 만들고 깊이에 맞는 종류를 쓴다', () => {
    const next: CheckItem[] = [{ id: 'q', title: '본행사', done: false, date: '2026-12-02', start: 0, end: 1, children: [{ id: 'u', title: '입장', done: false, assignee: '김' }] }];
    expect(diffTrees([], next)).toEqual([
      expect.objectContaining({ type: 'create', id: 'q', kind: 'program', parentId: null, status: '할 일', dueOn: '2026-12-02', startMinute: 540, endMinute: 600 }),
      expect.objectContaining({ type: 'create', id: 'u', kind: 'task', parentId: 'q', assignee: '김' }),
    ]);
  });

  it('제목·상태·담당자·날짜 변경을 각각의 작업으로 바꾸고, 하위가 있는 항목의 완료는 보내지 않는다', () => {
    const next: CheckItem[] = [{ ...base[0]!, done: true, date: '2026-12-01', children: [{ id: 't', title: '음향 체크', done: true, assignee: '박' }] }];
    expect(diffTrees(base, next)).toEqual([
      { type: 'reschedule', id: 'p', dueOn: '2026-12-01' },
      { type: 'update', id: 't', patch: { title: '음향 체크', status: '완료' } },
      { type: 'assign', id: 't', assignee: '박' },
    ]);
  });

  it('삭제는 가장 위 항목만 보낸다', () => {
    expect(diffTrees(base, [])).toEqual([{ type: 'remove', id: 'p' }]);
    expect(diffTrees(base, [{ ...base[0]!, children: [] }])).toEqual([{ type: 'remove', id: 't' }]);
  });

  it('완료를 되돌리면 진행 중으로 보낸다', () => {
    const done: CheckItem[] = [{ id: 't', title: 'x', done: true, workflowStatus: '완료' }];
    expect(diffTrees(done, [{ id: 't', title: 'x', done: false, workflowStatus: '진행' }])).toEqual([{ type: 'update', id: 't', patch: { status: '진행 중' } }]);
  });
});

describe('기존 저장값 옮기기', () => {
  it('uuid가 아닌 id만 새 uuid로 바꾼다', () => {
    const tree = withUuidIds([{ id: 'n1', title: 'a', done: false, children: [{ id: uid(9), title: 'b', done: false }] }]);
    expect(tree[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(tree[0]!.children![0]!.id).toBe(uid(9));
  });
});

describe('행 목록과 캘린더 블록', () => {
  it('바뀐 행은 저장, 사라진 행은 삭제한다', () => {
    const same = (a: { v: number }, b: { v: number }) => a.v === b.v;
    expect(diffRows([{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'a', v: 2 }, { id: 'c', v: 1 }], same)).toEqual({ save: [{ id: 'a', v: 2 }, { id: 'c', v: 1 }], remove: ['b'] });
  });

  it('블록의 일수·시각을 날짜·분으로 바꾸고 되돌린다', () => {
    const base = new Date(2026, 10, 23);
    const body = blockBody({ id: uid(1), eventId: uid(100), day: 8, title: '리허설', start: 1, end: 2.5 }, base);
    expect(body).toEqual({ title: '리허설', date: '2026-12-01', startMinute: 600, endMinute: 690 });
    expect(blockFromDto({ id: uid(1), eventId: uid(100), updatedAt: '2026-11-24T00:00:00.000Z', ...body }, base)).toMatchObject({ day: 8, start: 1, end: 2.5 });
  });
});
