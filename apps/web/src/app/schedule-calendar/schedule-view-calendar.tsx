'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CHIPS, MARCH_2025, MonthCalendar, type CalCell, type ChipKey } from '@miceplans/ui';

type CalendarView = 'event' | 'work';

const c = (d: number, ...chips: NonNullable<CalCell['chips']>): CalCell => ({ d, chips });
const B: CalCell = {};

const WORK_SCHEDULE_MARCH: CalCell[][] = [
  [B, B, B, B, B, B, c(1)],
  [c(2), c(3, 'designProduction'), c(4), c(5, 'designProduction'), c(6, 'designProduction', 'videoProduction'), c(7, 'videoProduction'), c(8, 'videoProduction')],
  [c(9, 'videoProduction'), c(10, 'designProduction', 'videoProduction'), c(11, 'videoProduction'), c(12, 'designProduction', 'videoProduction'), c(13, 'videoProduction'), c(14, 'videoProduction'), c(15, 'videoProduction')],
  [c(16, 'videoProduction'), c(17), c(18), c(19), c(20), c(21), c(22)],
  [c(23), c(24, 'designProduction'), c(25, 'designProduction'), c(26, 'designProduction'), c(27), c(28), c(29)],
  [c(30), c(31), B, B, B, B, B],
];

const VIEW_LABEL: Record<CalendarView, string> = {
  event: '행사 뷰',
  work: '작업 일정 뷰',
};

/* ---------- 내 일정(로그인 유저 담당 일정만 필터) ---------- */

/** 내 일정 목업의 로그인 유저 */
const CURRENT_USER = '박서연';

/** 칩별 담당자 목업 */
const CHIP_OWNER: Record<ChipKey, string> = {
  invite: '박서연',
  design: '박서연',
  kimesHome: '김도현',
  brochure: '한이음',
  ai: '김도현',
  rehearsal: '최수민',
  kimes: '박서연',
  designProduction: '박서연',
  videoProduction: '최수민',
};

/** 담당자가 로그인 유저인 칩만 남긴 월 그리드 */
function filterMyWeeks(weeks: CalCell[][]): CalCell[][] {
  return weeks.map((week) =>
    week.map((cell) => {
      const chips = cell.chips?.filter((k) => CHIP_OWNER[k] === CURRENT_USER);
      return { ...cell, chips: chips && chips.length > 0 ? chips : undefined };
    }),
  );
}

/** 행사·작업 일정 중 로그인 유저 담당 일정만 합친 월 그리드 */
function myScheduleWeeks(eventWeeks: CalCell[][], workWeeks: CalCell[][]): CalCell[][] {
  const myEvent = filterMyWeeks(eventWeeks);
  const myWork = filterMyWeeks(workWeeks);
  return myEvent.map((week, wi) =>
    week.map((cell, ci) => {
      const extra = myWork[wi]?.[ci]?.chips;
      return extra ? { ...cell, chips: [...(cell.chips ?? []), ...extra] } : cell;
    }),
  );
}

/* ---------- 행사·일정 종류별 표시 필터 ---------- */

const EVENTS = [
  { key: 'kimes', label: 'KIMES 2025', dot: 'bg-info' },
  { key: 'aiSummit', label: 'AI 서밋 2025', dot: 'bg-brand-pink-strong' },
] as const;
type EventKey = (typeof EVENTS)[number]['key'];

/** 칩이 속한 행사 (행사 뷰 칩은 일정 agenda의 행사 메타, 작업 칩은 라벨 접두사 기준 목업) */
const EVENT_OF: Record<ChipKey, EventKey> = {
  invite: 'kimes',
  design: 'kimes',
  kimesHome: 'kimes',
  brochure: 'kimes',
  rehearsal: 'kimes',
  kimes: 'kimes',
  ai: 'aiSummit',
  designProduction: 'kimes',
  videoProduction: 'aiSummit',
};

const EVENT_KEYS: readonly EventKey[] = EVENTS.map((e) => e.key);
const CHIP_KEYS = Object.keys(CHIPS) as ChipKey[];

const LS_EVENTS = 'miceplans:schedule-calendar:events';
const LS_KINDS = 'miceplans:schedule-calendar:chip-kinds';

const allOn = <T extends string>(keys: readonly T[], value = true): Record<T, boolean> =>
  Object.fromEntries(keys.map((k) => [k, value])) as Record<T, boolean>;

/** localStorage에 저장된 필터 값을 읽는다. 저장값이 없거나 깨지면 전체 표시다. */
function loadPrefs<T extends string>(key: string, keys: readonly T[]): Record<T, boolean> {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return { ...allOn(keys), ...(JSON.parse(raw) as Record<T, boolean>) };
  } catch {
    // 깨진 저장값은 무시하고 기본값(전체 표시)을 쓴다
  }
  return allOn(keys);
}

/** 숨긴 행사·종류의 칩을 뺀 월 그리드 */
function filterVisible(weeks: CalCell[][], eventsOn: Record<EventKey, boolean>, kindsOn: Record<ChipKey, boolean>): CalCell[][] {
  return weeks.map((week) =>
    week.map((cell) => {
      const chips = cell.chips?.filter((k) => eventsOn[EVENT_OF[k]] !== false && kindsOn[k] !== false);
      return { ...cell, chips: chips && chips.length > 0 ? chips : undefined };
    }),
  );
}

function ToggleRow({ dotClass, label, on, onToggle }: { dotClass: string; label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className={`flex w-full items-center gap-[8px] rounded-sm px-[8px] py-[6px] text-left text-sm ${on ? 'bg-brand-tint font-medium text-brand' : 'text-fg hover:bg-surface-muted'}`}
    >
      <span className={`size-[8px] shrink-0 rounded-full ${dotClass}`} />
      <span className="min-w-0 flex-1 truncate whitespace-nowrap">{label}</span>
      <span aria-hidden="true" className={`text-2xs ${on ? 'text-brand' : 'text-transparent'}`}>✓</span>
    </button>
  );
}

function FilterGroup({ label, onAll, children }: { label: string; onAll: (on: boolean) => void; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-[6px] py-[4px]">
        <p className="whitespace-nowrap text-2xs font-semibold text-fg-tertiary">{label}</p>
        <div className="flex items-center gap-[10px]">
          <button type="button" onClick={() => onAll(true)} className="whitespace-nowrap text-2xs text-fg-secondary hover:text-fg">전체 선택</button>
          <button type="button" onClick={() => onAll(false)} className="whitespace-nowrap text-2xs text-fg-secondary hover:text-fg">전체 해제</button>
        </div>
      </div>
      {children}
    </div>
  );
}

/** 행사별·일정 종류별 표시 필터 팝오버 (보기 전환 옆에 배치) */
function FilterMenu({
  eventsOn,
  kindsOn,
  onToggleEvent,
  onSetAllEvents,
  onToggleKind,
  onSetAllKinds,
}: {
  eventsOn: Record<EventKey, boolean>;
  kindsOn: Record<ChipKey, boolean>;
  onToggleEvent: (key: EventKey) => void;
  onSetAllEvents: (on: boolean) => void;
  onToggleKind: (key: ChipKey) => void;
  onSetAllKinds: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[32px] items-center gap-[7px] rounded-sm border border-solid border-border bg-surface px-[10px] text-sm font-medium text-fg hover:bg-surface-muted"
      >
        <span>표시 항목 필터</span>
        <span aria-hidden="true" className="text-2xs text-fg-secondary">▾</span>
      </button>
      {open ? (
        <>
          <button type="button" aria-label="필터 메뉴 닫기" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" aria-label="캘린더 표시 항목 필터" className="absolute right-0 top-[38px] z-20 flex max-h-[420px] w-[248px] flex-col gap-[4px] overflow-y-auto rounded-md border border-solid border-border bg-surface p-[8px] shadow-card">
            <FilterGroup label="행사별 표시" onAll={onSetAllEvents}>
              {EVENTS.map((e) => (
                <ToggleRow key={e.key} dotClass={e.dot} label={e.label} on={eventsOn[e.key] !== false} onToggle={() => onToggleEvent(e.key)} />
              ))}
            </FilterGroup>
            <div className="my-[2px] h-px shrink-0 bg-border" />
            <FilterGroup label="일정 종류별 표시" onAll={onSetAllKinds}>
              {CHIP_KEYS.map((k) => (
                <ToggleRow key={k} dotClass={CHIPS[k].bg} label={CHIPS[k].label} on={kindsOn[k] !== false} onToggle={() => onToggleKind(k)} />
              ))}
            </FilterGroup>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ScheduleViewCalendar({
  mine = false,
  eventWeeks = MARCH_2025,
  workWeeks = WORK_SCHEDULE_MARCH,
  gridGap,
  padX,
}: {
  /** 내 일정 탭: 로그인 유저 담당 일정만 표시하고 보기 전환을 숨긴다 */
  mine?: boolean;
  eventWeeks?: CalCell[][];
  workWeeks?: CalCell[][];
  gridGap?: number;
  padX?: number;
}) {
  const [view, setView] = useState<CalendarView>('event');
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventsOn, setEventsOn] = useState<Record<EventKey, boolean>>(() => allOn(EVENT_KEYS));
  const [kindsOn, setKindsOn] = useState<Record<ChipKey, boolean>>(() => allOn(CHIP_KEYS));

  /* 새로고침 후에도 필터를 유지한다 (hydration 직후 저장값 적용) */
  useEffect(() => {
    setEventsOn(loadPrefs(LS_EVENTS, EVENT_KEYS));
    setKindsOn(loadPrefs(LS_KINDS, CHIP_KEYS));
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_EVENTS, JSON.stringify(eventsOn));
    } catch {
      // 저장 실패는 무시한다
    }
  }, [eventsOn]);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KINDS, JSON.stringify(kindsOn));
    } catch {
      // 저장 실패는 무시한다
    }
  }, [kindsOn]);

  const visibleWeeks = (weeks: CalCell[][]): CalCell[][] => filterVisible(weeks, eventsOn, kindsOn);

  const selectView = (next: CalendarView) => {
    setView(next);
    setMenuOpen(false);
  };

  if (mine) {
    return (
      <MonthCalendar
        title="2025년 3월"
        weeks={visibleWeeks(myScheduleWeeks(eventWeeks, workWeeks))}
        gridGap={gridGap}
        padX={padX}
        personal
      />
    );
  }

  return (
    <MonthCalendar
      title="2025년 3월"
      weeks={visibleWeeks(view === 'event' ? eventWeeks : workWeeks)}
      gridGap={gridGap}
      padX={padX}
      headerAddon={
        <div className="relative ml-[6px] flex items-center gap-[6px]">
          <FilterMenu
            eventsOn={eventsOn}
            kindsOn={kindsOn}
            onToggleEvent={(key) => setEventsOn((prev) => ({ ...prev, [key]: !prev[key] }))}
            onSetAllEvents={(on) => setEventsOn(allOn(EVENT_KEYS, on))}
            onToggleKind={(key) => setKindsOn((prev) => ({ ...prev, [key]: !prev[key] }))}
            onSetAllKinds={(on) => setKindsOn(allOn(CHIP_KEYS, on))}
          />
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-[32px] items-center gap-[7px] rounded-sm border border-solid border-border bg-surface px-[10px] text-sm font-medium text-fg hover:bg-surface-muted"
            >
              <span>{VIEW_LABEL[view]}</span>
              <span aria-hidden="true" className="text-2xs text-fg-secondary">▾</span>
            </button>
            {menuOpen ? (
              <>
                <button type="button" aria-label="보기 메뉴 닫기" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
                <div role="menu" aria-label="캘린더 보기" className="absolute right-0 top-[38px] z-20 w-[156px] rounded-md border border-solid border-border bg-surface p-[4px] shadow-card">
                  {(Object.keys(VIEW_LABEL) as CalendarView[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="menuitemradio"
                      aria-checked={view === item}
                      onClick={() => selectView(item)}
                      className={`flex w-full items-center rounded-sm px-[10px] py-[8px] text-left text-sm ${view === item ? 'bg-brand-tint font-semibold text-brand' : 'text-fg hover:bg-surface-muted'}`}
                    >
                      {VIEW_LABEL[item]}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
