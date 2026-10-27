'use client';

import { useContext } from 'react';

import { ItemAccessContext, type CheckItem } from './event-checklist';

export type SortKey = '기본' | '마감일 빠른순' | '마감일 늦은순';
export type StatusFilter = '전체' | '예정' | '지연' | '완료';
export type DueFilter = '전체' | '오늘' | '이번 주' | '마감일 없음';
/** 담당자 필터. '나'와 '미지정'은 예약값이고 그 외에는 담당자 이름이다. */
export type AssigneeFilter = string;

export type ItemFilter = {
  sort: SortKey;
  status: StatusFilter;
  due: DueFilter;
  assignee: AssigneeFilter;
  query: string;
};

export const DEFAULT_FILTER: ItemFilter = { sort: '기본', status: '전체', due: '전체', assignee: '전체', query: '' };

export const SORT_KEYS: SortKey[] = ['기본', '마감일 빠른순', '마감일 늦은순'];
const STATUS_FILTERS: StatusFilter[] = ['전체', '예정', '지연', '완료'];
const DUE_FILTERS: DueFilter[] = ['전체', '오늘', '이번 주', '마감일 없음'];

export function isFilterActive(f: ItemFilter): boolean {
  return f.status !== '전체' || f.due !== '전체' || f.assignee !== '전체' || f.query.trim() !== '';
}

const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 'MM.DD' 또는 '오늘' 형식의 마감일을 해당 연도의 날짜(ms)로 바꾼다. 해석할 수 없으면 undefined. */
export function parseDue(date: string | undefined, now: Date = new Date()): number | undefined {
  if (!date) return undefined;
  if (date === '오늘') return startOfDay(now);
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(date.trim());
  if (!m) return undefined;
  return new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2])).getTime();
}

function statusLabel(item: CheckItem): StatusFilter {
  return item.done ? '완료' : item.late ? '지연' : '예정';
}

function matchDue(item: CheckItem, due: DueFilter, now: Date): boolean {
  if (due === '전체') return true;
  const t = parseDue(item.date, now);
  if (due === '마감일 없음') return t === undefined;
  if (t === undefined) return false;
  const today = startOfDay(now);
  return due === '오늘' ? t === today : t >= today && t < today + 7 * DAY;
}

function matchAssignee(item: CheckItem, assignee: AssigneeFilter, me: string): boolean {
  if (assignee === '전체') return true;
  if (assignee === '미지정') return !item.assignee && !item.owner;
  const name = assignee === '나' ? me : assignee;
  return item.assignee === name;
}

function matchSelf(item: CheckItem, f: ItemFilter, me: string, now: Date): boolean {
  const q = f.query.trim().toLowerCase();
  return (
    (f.status === '전체' || statusLabel(item) === f.status) &&
    matchDue(item, f.due, now) &&
    matchAssignee(item, f.assignee, me) &&
    (!q || item.title.toLowerCase().includes(q))
  );
}

/** 항목 자신이나 하위 항목 중 하나라도 조건에 맞으면 남긴다. */
function matchTree(item: CheckItem, f: ItemFilter, me: string, now: Date): boolean {
  return matchSelf(item, f, me, now) || (item.children ?? []).some((c) => matchTree(c, f, me, now));
}

/** 마감일 순 정렬. 마감일이 없는 항목은 방향과 관계없이 맨 뒤에 둔다. 같은 마감일은 원래 순서를 유지한다. */
export function sortByDue<T extends CheckItem>(items: T[], sort: SortKey, now: Date = new Date()): T[] {
  if (sort === '기본') return items;
  const dir = sort === '마감일 빠른순' ? 1 : -1;
  return items
    .map((item, i) => ({ item, i, t: parseDue(item.date, now) }))
    .sort((a, b) => {
      if (a.t === undefined || b.t === undefined) return a.t === b.t ? a.i - b.i : a.t === undefined ? 1 : -1;
      return (a.t - b.t) * dir || a.i - b.i;
    })
    .map((x) => x.item);
}

/** 필터를 적용한 뒤 정렬한다. 하위 항목도 같은 기준으로 정렬하되 필터는 최상위 항목에만 적용한다. */
export function applyFilter<T extends CheckItem>(items: T[], f: ItemFilter, me: string, now: Date = new Date()): T[] {
  const kept = isFilterActive(f) ? items.filter((item) => matchTree(item, f, me, now)) : items;
  return sortByDue(kept, f.sort, now).map((item) =>
    item.children ? { ...item, children: sortByDue(item.children, f.sort, now) } : item,
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <label className="flex items-center gap-[6px] text-xs text-fg-tertiary">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`h-[26px] rounded-md border border-solid bg-surface px-[6px] text-xs outline-none focus:border-brand ${value === options[0] && label !== '정렬' ? 'border-border text-fg-secondary' : 'border-brand text-brand'}`}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

/** 스케줄·할 일 탭 공용 필터 바. 마감일 정렬, 상태·마감·담당자 필터, 제목 검색을 제공한다. */
export function FilterBar({ filter, onChange, shown, total }: { filter: ItemFilter; onChange: (f: ItemFilter) => void; shown: number; total: number }) {
  const { members } = useContext(ItemAccessContext);
  const set = <K extends keyof ItemFilter>(key: K, value: ItemFilter[K]) => onChange({ ...filter, [key]: value });
  const assignees = ['전체', '나', '미지정', ...members];
  const active = isFilterActive(filter) || filter.sort !== '기본';

  return (
    <div className="flex w-full flex-wrap items-center gap-x-[12px] gap-y-[6px] pt-[12px]" role="search" aria-label="목록 필터">
      <Select label="정렬" value={filter.sort} options={SORT_KEYS} onChange={(v) => set('sort', v)} />
      <Select label="상태" value={filter.status} options={STATUS_FILTERS} onChange={(v) => set('status', v)} />
      <Select label="마감" value={filter.due} options={DUE_FILTERS} onChange={(v) => set('due', v)} />
      <Select label="담당자" value={filter.assignee} options={assignees} onChange={(v) => set('assignee', v)} />
      <input
        value={filter.query}
        placeholder="제목 검색"
        aria-label="제목 검색"
        onChange={(e) => set('query', e.target.value)}
        className="h-[26px] w-[140px] rounded-md border border-solid border-border bg-surface px-[8px] text-xs text-fg outline-none placeholder:text-fg-tertiary focus:border-brand"
      />
      {active && (
        <>
          <span className="text-xs tabular-nums text-fg-tertiary">{shown}/{total}건</span>
          <button type="button" onClick={() => onChange(DEFAULT_FILTER)} className="text-xs text-fg-tertiary underline hover:text-fg-secondary">
            초기화
          </button>
        </>
      )}
    </div>
  );
}
