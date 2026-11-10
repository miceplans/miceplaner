'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { SidePeekPanel } from './side-peek';
import { type PersonalTodo } from './personal-todo';
import { Input } from './field';
import { statusTones, type StatusToneKey } from './tokens';

const A = '/assets/schedule';

/* ---------- 상태 pill ---------- */

export type StatusKey = '진행중' | '성공' | '확인중' | '만료' | '제출' | '보류중';

const TONE_OF: Record<StatusKey, StatusToneKey> = {
  진행중: 'progress',
  성공: 'success',
  확인중: 'review',
  만료: 'expired',
  제출: 'submit',
  보류중: 'hold',
};

function StatusIcon({ status }: { status: StatusKey }): ReactNode {
  switch (status) {
    case '진행중':
      return (
        <span className="relative size-[12px] shrink-0">
          <span className="absolute inset-[-5.83%]">
            <img alt="" src={`${A}/27ae9.svg`} className="block size-full max-w-none" />
          </span>
        </span>
      );
    case '성공':
      return <img alt="" src={`${A}/6bb8d.svg`} className="block size-[14.333px] shrink-0" />;
    case '확인중':
      return <img alt="" src={`${A}/698cb.svg`} className="block h-[11.828px] w-[12px] shrink-0" />;
    case '만료':
      return <img alt="" src={`${A}/c7e29.svg`} className="block size-[14px] shrink-0" />;
    case '보류중':
      return <img alt="" src={`${A}/36f5f.svg`} className="block h-[11.046px] w-[12.596px] shrink-0" />;
    case '제출':
      return (
        <span className="flex h-[16.158px] w-[16.4px] shrink-0 items-center justify-center">
          <span className="relative block h-[12px] w-[12.5px] flex-none rotate-[25deg]">
            <span className="absolute inset-[3.88%_4.83%_3.84%_4.23%]">
              <img alt="" src={`${A}/0cf85.svg`} className="block size-full max-w-none" />
            </span>
          </span>
        </span>
      );
  }
}

export function StatusPill({ status }: { status: StatusKey }): ReactNode {
  const tone = statusTones[TONE_OF[status]];
  return (
    <span className="inline-flex h-[24px] items-center gap-[4px] rounded-sm px-[8px]" style={{ background: tone.bg }}>
      <StatusIcon status={status} />
      <span className="whitespace-nowrap text-xs font-bold" style={{ color: tone.fg }}>{tone.label}</span>
    </span>
  );
}

/* ---------- Topbar ---------- */

export function Topbar(): ReactNode {
  return (
    <div className="flex h-[56px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
      <button type="button" aria-label="사이드바 토글" className="flex size-[28px] shrink-0 items-center justify-center rounded-sm hover:bg-surface-chip">
        <img alt="" src={`${A}/6fc38.svg`} className="size-[16px]" />
      </button>
      <div className="flex h-full shrink-0 items-center gap-[6px] text-base">
        <span className="whitespace-nowrap text-fg-secondary">워크스페이스</span>
        <img alt="" src={`${A}/a7eff.svg`} className="size-[13px]" />
        <span className="whitespace-nowrap font-semibold text-fg">일정</span>
      </div>
      <div className="h-px min-w-px flex-1" />
      <label className="flex h-[32px] w-[280px] shrink-0 items-center gap-[8px] rounded-sm bg-surface-chip px-[10px] max-md:hidden">
        <img alt="" src={`${A}/1e4e7.svg`} className="size-[15px] shrink-0" />
        <Input
          type="text"
          placeholder="검색"
          variant="ghost"
          className="min-w-0 flex-1 text-base"
        />
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface px-[5px] text-2xs text-fg-secondary">⌘K</span>
      </label>
      <a href="/import/upload" className="flex h-[30px] shrink-0 items-center gap-[6px] rounded-sm bg-brand px-[12px] text-base font-semibold text-fg-inverse hover:bg-brand max-md:hidden">
        <img alt="" src={`${A}/05c58.svg`} className="size-[14px]" />
        <span className="whitespace-nowrap">새 행사</span>
      </a>
    </div>
  );
}

/* ---------- View tabs ---------- */

export type ViewTab = { label: string; icon: string; activeIcon?: string; href?: string };

/** `/`로 시작하면 전체 경로, 아니면 `/assets/schedule` 아래 파일명으로 해석한다. */
const tabIcon = (name: string): string => (name.startsWith('/') ? name : `${A}/${name}.svg`);

export function ViewTabs({ tabs, active, bordered = false, onChange, action }: { tabs: ViewTab[]; active: number; bordered?: boolean; onChange?: (index: number) => void; action?: ReactNode }): ReactNode {
  return (
    <div className={`flex h-[52px] w-full shrink-0 items-center px-[24px] max-md:px-[8px] ${bordered ? 'border-b border-solid border-border' : ''}`}>
      <div className="flex h-full min-w-max items-start gap-[2px]">
        {tabs.map((t, i) => {
          const on = i === active;
          const cls = `flex h-full items-center gap-[7px] px-[12px] text-base ${
            on ? 'border-b-2 border-solid border-brand font-medium text-brand' : 'text-fg-secondary hover:text-fg'
          }`;
          const body = (
            <>
              <img alt="" src={tabIcon(on && t.activeIcon ? t.activeIcon : t.icon)} className="size-[15px]" />
              <span className="whitespace-nowrap">{t.label}</span>
            </>
          );
          return t.href ? (
            <a key={t.label} href={t.href} className={cls} aria-current={on ? 'page' : undefined}>
              {body}
            </a>
          ) : (
            <button key={t.label} type="button" onClick={() => onChange?.(i)} className={cls}>
              {body}
            </button>
          );
        })}
      </div>
      {action ? <div className="ml-auto flex shrink-0 items-center">{action}</div> : null}
    </div>
  );
}

/* ---------- 월간 캘린더 ---------- */

export type ChipKey = 'invite' | 'design' | 'brochure' | 'ai' | 'rehearsal' | 'kimes' | 'kimesHome' | 'designProduction' | 'videoProduction';

export const CHIPS: Record<ChipKey, { label: string; bg: string; fg: string; dot: string; /** 밝은 배경 칩(어두운 빗금 적용) */ light?: boolean }> = {
  invite: { label: '일정', bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: '9cd3e', light: true },
  design: { label: '일정', bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: '9cd3e', light: true },
  kimesHome: { label: '일정', bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: '9cd3e', light: true },
  brochure: { label: '일정', bg: 'bg-warning-hold', fg: 'text-fg-inverse', dot: 'e2e7c' },
  ai: { label: '일정', bg: 'bg-brand-pink-strong', fg: 'text-fg-inverse', dot: 'e2e7c' },
  rehearsal: { label: '리허설', bg: 'bg-error-brand', fg: 'text-fg-inverse', dot: 'e2e7c' },
  kimes: { label: '일정', bg: 'bg-error-brand', fg: 'text-fg-inverse', dot: 'e2e7c' },
  designProduction: { label: '디자인 제작물', bg: 'bg-info', fg: 'text-fg-inverse', dot: 'e2e7c' },
  videoProduction: { label: '영상 제작물', bg: 'bg-error-brand', fg: 'text-fg-inverse', dot: 'e2e7c' },
};

export type CalCell = { d?: number; today?: boolean; chips?: ChipKey[] };

/** 연·월의 달력 그리드를 만든다. 주는 일요일 시작이고 앞뒤 빈 칸은 빈 셀로 채운다. 오늘 날짜면 today를 표시한다. */
export function buildMonthWeeks(year: number, month: number, today = new Date()): CalCell[][] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate();
  const cells: CalCell[] = [
    ...Array<CalCell>(firstWeekday).fill({}),
    ...Array.from({ length: daysInMonth }, (_, i): CalCell => ({ d: i + 1, today: isToday(i + 1) })),
  ];
  while (cells.length % 7) cells.push({});
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** 이전/다음 달 커서를 구한다. */
export function shiftMonth(cursor: { year: number; month: number }, delta: number): { year: number; month: number } {
  const d = new Date(cursor.year, cursor.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Segment = { k: ChipKey; start: number; end: number; lane: number; contFrom: boolean; contTo: boolean };
type TodoBarSeg = { kind: 'todoBar'; todo: PersonalTodo; start: number; end: number; lane: number; contFrom: boolean; contTo: boolean };
type TodoDotSeg = { kind: 'todoDot'; todo: PersonalTodo; start: number; end: number; lane: number };
type LaneEntry = ({ kind: 'chip' } & Segment) | TodoBarSeg | TodoDotSeg;

/**
 * 한 주의 레인 항목을 모은다. 행사 칩의 연속 날짜, 기간이 있는 내 할 일(빗금 바), 마감일만 있는 내 할 일(빗금 동그라미)을
 * 하나의 목록으로 겹치지 않게 줄(lane)을 배정한다.
 */
function buildLaneEntries(week: CalCell[], prevWeek: CalCell[] | undefined, nextWeek: CalCell[] | undefined, todos: PersonalTodo[]): LaneEntry[] {
  const has = (cell: CalCell | undefined, k: ChipKey) => !!cell?.chips?.includes(k);
  const keys: ChipKey[] = [];
  week.forEach((cell) => cell.chips?.forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  const raw: ((Omit<Segment, 'lane'> & { kind: 'chip' }) | Omit<TodoBarSeg, 'lane'> | Omit<TodoDotSeg, 'lane'>)[] = [];
  for (const k of keys) {
    let i = 0;
    while (i < 7) {
      if (!has(week[i], k)) { i++; continue; }
      let j = i;
      while (j + 1 < 7 && has(week[j + 1], k)) j++;
      raw.push({
        kind: 'chip',
        k,
        start: i,
        end: j,
        contFrom: i === 0 ? has(prevWeek?.[6], k) : false,
        contTo: j === 6 ? has(nextWeek?.[0], k) : false,
      });
      i = j + 1;
    }
  }
  const dayOf = (cell: CalCell | undefined) => cell?.d;
  for (const todo of todos) {
    if (todo.start !== undefined && todo.end !== undefined) {
      const { start, end } = todo;
      const inRange = (d: number | undefined) => d !== undefined && d >= start && d <= end;
      let i = 0;
      while (i < 7) {
        if (!inRange(dayOf(week[i]))) { i++; continue; }
        let j = i;
        while (j + 1 < 7 && inRange(dayOf(week[j + 1]))) j++;
        raw.push({
          kind: 'todoBar',
          todo,
          start: i,
          end: j,
          contFrom: i === 0 ? inRange(dayOf(prevWeek?.[6])) : false,
          contTo: j === 6 ? inRange(dayOf(nextWeek?.[0])) : false,
        });
        i = j + 1;
      }
    } else if (todo.due !== undefined) {
      const idx = week.findIndex((cell) => cell.d === todo.due);
      if (idx >= 0) raw.push({ kind: 'todoDot', todo, start: idx, end: idx });
    }
  }
  raw.sort((x, y) => x.start - y.start || y.end - x.end);
  const laneEnd: number[] = [];
  return raw.map((seg) => {
    let lane = laneEnd.findIndex((e) => e < seg.start);
    if (lane === -1) lane = laneEnd.length;
    laneEnd[lane] = seg.end;
    return { ...seg, lane } as LaneEntry;
  });
}

function Bar({ seg, striped, onClick }: { seg: Segment; striped?: boolean; onClick: (e: MouseEvent<HTMLButtonElement>) => void }): ReactNode {
  const ch = CHIPS[seg.k];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ch.label}
      title={ch.label}
      style={{ gridColumn: `${seg.start + 1} / ${seg.end + 2}`, gridRow: seg.lane + 1 }}
      className={`pointer-events-auto flex h-[20px] min-w-0 cursor-pointer items-center gap-[4px] px-[6px] text-2xs font-medium hover:opacity-80 ${ch.bg} ${ch.fg} ${
        striped ? (ch.light ? 'bg-stripes-dark' : 'bg-stripes') : ''
      } ${
        seg.contFrom ? 'ml-0 rounded-l-none' : 'ml-[4px] rounded-l-xs'
      } ${seg.contTo ? 'mr-0 rounded-r-none' : 'mr-[4px] rounded-r-xs'}`}
    >
      {seg.contFrom ? null : <img alt="" src={`${A}/${ch.dot}.svg`} className="size-[5px] shrink-0" />}
      <span className="truncate whitespace-nowrap">{seg.contFrom ? '' : ch.label}</span>
    </button>
  );
}

/** 빗금 동그라미 표시 마커 */
function TodoStripeDot(): ReactNode {
  return <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-surface-chip bg-stripes-dark ring-1 ring-border-strong" />;
}

/** 기간이 있는 내 할 일: 항상 빗금을 입힌 바로 표시한다 */
function TodoBar({ seg, onClick }: { seg: TodoBarSeg; onClick: (e: MouseEvent<HTMLButtonElement>) => void }): ReactNode {
  const done = !!seg.todo.done;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={seg.todo.title}
      title={seg.todo.title}
      style={{ gridColumn: `${seg.start + 1} / ${seg.end + 2}`, gridRow: seg.lane + 1 }}
      className={`pointer-events-auto flex h-[20px] min-w-0 cursor-pointer items-center gap-[4px] bg-surface-chip bg-stripes-dark px-[6px] text-2xs font-medium text-fg-secondary hover:opacity-80 ${
        seg.contFrom ? 'ml-0 rounded-l-none' : 'ml-[4px] rounded-l-xs'
      } ${seg.contTo ? 'mr-0 rounded-r-none' : 'mr-[4px] rounded-r-xs'} ${done ? 'opacity-60' : ''}`}
    >
      {seg.contFrom ? null : <TodoStripeDot />}
      <span className={`truncate whitespace-nowrap ${done ? 'line-through' : ''}`}>{seg.contFrom ? '' : seg.todo.title}</span>
    </button>
  );
}

/** 마감일만 있는 내 할 일: 바 배경 없이 빗금 동그라미와 제목만 표시한다 */
function TodoDot({ seg, onClick }: { seg: TodoDotSeg; onClick: (e: MouseEvent<HTMLButtonElement>) => void }): ReactNode {
  const done = !!seg.todo.done;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={seg.todo.title}
      title={seg.todo.title}
      style={{ gridColumn: `${seg.start + 1} / ${seg.end + 2}`, gridRow: seg.lane + 1 }}
      className={`pointer-events-auto flex h-[20px] min-w-0 cursor-pointer items-center gap-[4px] px-[6px] text-2xs font-medium text-fg-secondary hover:bg-surface-muted ${done ? 'opacity-60' : ''}`}
    >
      <TodoStripeDot />
      <span className={`truncate whitespace-nowrap ${done ? 'line-through' : ''}`}>{seg.todo.title}</span>
    </button>
  );
}

export function MonthCalendar({
  headerAddon,
  gridGap = 24,
  thickRows = [3],
  firstRowTopBorder = true,
  padX = 24,
  personal = false,
  todos = [],
  initialMonth,
}: {
  /** 월 제목 옆에 표시할 보기 전환 등 보조 컨트롤 */
  headerAddon?: ReactNode;
  gridGap?: number;
  /** 아래 경계선이 이중으로 보이는 주(0부터) */
  thickRows?: number[];
  firstRowTopBorder?: boolean;
  /** 그리드 좌우 여백(px) */
  padX?: number;
  /** 개인 일정(내 일정) 모드: 칩 배경에 빗금을 입힌다 */
  personal?: boolean;
  /** 달력에 함께 표시할 내 할 일. 기간이 있으면 빗금 바, 마감일만 있으면 빗금 동그라미 항목으로 표시한다 */
  todos?: PersonalTodo[];
  /** 처음에 표시할 월. 없으면 이번 달이다. 이전/다음 달 버튼으로 월을 옮긴다. */
  initialMonth?: { year: number; month: number };
}): ReactNode {
  const [cursor, setCursor] = useState(() => initialMonth ?? (() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() + 1 }; })());
  const weeks = buildMonthWeeks(cursor.year, cursor.month);
  const title = `${cursor.year}년 ${cursor.month}월`;
  const last = weeks.length - 1;
  const [peek, setPeek] = useState<{ title: string; date: string; day: number } | null>(null);
  return (
    <div className="flex w-full flex-col items-center" style={{ gap: gridGap }}>
      {peek ? <SidePeekPanel title={peek.title} date={peek.date} agenda={[]} onClose={() => setPeek(null)} /> : null}
      <div className="flex shrink-0 items-center gap-[17.895px]">
        <button type="button" aria-label="이전 달" onClick={() => setCursor((c) => shiftMonth(c, -1))} className="size-[26.842px] rounded-sm hover:bg-surface-chip">
          <img alt="" src={`${A}/4f176.svg`} className="size-full" />
        </button>
        <p className="whitespace-nowrap text-3xl font-semibold text-fg">{title}</p>
        <button type="button" aria-label="다음 달" onClick={() => setCursor((c) => shiftMonth(c, 1))} className="size-[26.842px] rounded-sm hover:bg-surface-chip">
          <img alt="" src={`${A}/2e379.svg`} className="size-full" />
        </button>
        {headerAddon}
      </div>
      <div className="flex w-full flex-1 flex-col items-center overflow-x-auto pb-[24px]" style={{ paddingInline: padX }}>
        <div className="flex h-[32px] w-full shrink-0 items-start bg-surface">
          {WEEKDAYS.map((w) => (
            <div key={w} className="flex h-full flex-1 items-center justify-center text-xs font-medium text-fg-tertiary">
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={`relative grid h-[102px] w-full shrink-0 grid-cols-7 items-start border-b border-solid border-border-strong ${
              wi === last ? 'rounded-b-md' : ''
            }`}
          >
            {week.map((cell, ci) => {
              const border = [
                'border-r border-solid border-border-soft',
                ci === 0 ? 'border-l' : '',
                wi === 0 && firstRowTopBorder ? 'border-t' : '',
                thickRows.includes(wi) ? 'border-b' : '',
                wi === last && ci === 0 ? 'rounded-bl-md' : '',
                wi === last && ci === 6 ? 'rounded-br-md' : '',
              ].join(' ');
              return (
                <div
                  key={ci}
                  onClick={cell.d === undefined ? undefined : () => setPeek({ title: `${cell.d}일 일정`, date: `${title} ${cell.d}일`, day: cell.d! })}
                  className={`flex h-full flex-col items-start gap-[4px] px-[8px] pb-[6px] pt-[8px] ${cell.d === undefined ? '' : 'cursor-pointer hover:bg-surface-muted'} ${
                    cell.d === undefined ? 'bg-surface-subtle' : 'bg-surface'
                  } ${border}`}
                >
                  {cell.today ? (
                    <span className="flex shrink-0 items-center gap-[4px]">
                      <span className="flex size-[22px] items-center justify-center rounded-lg bg-brand text-xs font-semibold text-fg-inverse">
                        {cell.d}
                      </span>
                      <span className="text-2xs font-medium text-fg-tertiary">({WEEKDAYS[ci]})</span>
                    </span>
                  ) : cell.d !== undefined ? (
                    <span className="shrink-0 whitespace-nowrap text-sm text-fg-secondary">
                      {cell.d} <span className="text-2xs text-fg-tertiary">({WEEKDAYS[ci]})</span>
                    </span>
                  ) : null}
                </div>
              );
            })}
            <div className="pointer-events-none absolute inset-x-0 top-[38px] grid grid-cols-7 auto-rows-[20px] gap-y-[4px]">
              {buildLaneEntries(week, weeks[wi - 1], weeks[wi + 1], todos).map((entry) => {
                const day = week[entry.start].d!;
                const openPeek = (itemTitle: string) => (e: MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  setPeek({ title: itemTitle, date: `${title} ${day}일`, day });
                };
                if (entry.kind === 'todoBar') {
                  return <TodoBar key={`todo-${entry.todo.id}-${entry.start}`} seg={entry} onClick={openPeek(entry.todo.title)} />;
                }
                if (entry.kind === 'todoDot') {
                  return <TodoDot key={`todo-${entry.todo.id}-${entry.start}`} seg={entry} onClick={openPeek(entry.todo.title)} />;
                }
                return (
                  <Bar
                    key={`${entry.k}-${entry.start}`}
                    seg={entry}
                    striped={personal}
                    onClick={openPeek(CHIPS[entry.k].label)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 사이드바 활성 탭 아이콘 세트 */
export const SCHEDULE_TABS: ViewTab[] = [
  { label: '전체 일정', icon: 'ffeb6', activeIcon: '753c4', href: '/schedule-table' },
  { label: '내 일정', icon: '10b86' },
  { label: '캘린더', icon: 'b0b49', activeIcon: '85cb7', href: '/schedule-calendar' },
];
