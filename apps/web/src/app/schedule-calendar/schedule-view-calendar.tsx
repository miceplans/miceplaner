'use client';

import { useState } from 'react';
import { MARCH_2025, MonthCalendar, type CalCell } from '@miceplans/ui';

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

export function ScheduleViewCalendar({
  eventWeeks = MARCH_2025,
  workWeeks = WORK_SCHEDULE_MARCH,
  gridGap,
  padX,
}: {
  eventWeeks?: CalCell[][];
  workWeeks?: CalCell[][];
  gridGap?: number;
  padX?: number;
}) {
  const [view, setView] = useState<CalendarView>('event');
  const [menuOpen, setMenuOpen] = useState(false);

  const selectView = (next: CalendarView) => {
    setView(next);
    setMenuOpen(false);
  };

  return (
    <MonthCalendar
      title="2025년 3월"
      weeks={view === 'event' ? eventWeeks : workWeeks}
      gridGap={gridGap}
      padX={padX}
      headerAddon={
        <div className="relative ml-[6px]">
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
      }
    />
  );
}
