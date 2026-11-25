'use client';

import { useMemo } from 'react';
import type { PortalProgramDto } from '@miceplans/contracts/portal';
import { calendarWeeks, chipsByDay, todayIso, type ScheduleState } from '../../portal';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const TONE: Record<ScheduleState, string> = {
  예정: 'bg-notice-bg text-notice',
  진행중: 'bg-ongoing-bg text-scheduled',
  완료: 'bg-surface-chip text-fg-secondary',
};

/** 한 달 Program 일정. Client 캘린더(Figma 159:6251)의 칸·칩 규격을 쓰고, 알림이 가리키는 일정은 테두리로 강조한다. */
export function ProgramCalendar({ programs, year, month, highlightId }: { programs: PortalProgramDto[]; year: number; month: number; highlightId: string }) {
  const today = todayIso();
  const weeks = useMemo(() => calendarWeeks(year, month), [year, month]);
  const chips = useMemo(() => chipsByDay(programs, year, month, today), [programs, year, month, today]);
  const todayDay = today.startsWith(`${year}-${String(month).padStart(2, '0')}`) ? Number(today.slice(8)) : null;

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-solid border-border bg-surface">
      <div className="flex min-w-[640px] flex-col">
        <div className="grid h-[32px] grid-cols-7 border-b border-solid border-border">
          {WEEKDAYS.map((d) => (
            <p key={d} className="flex items-center justify-center text-xs font-medium text-fg-tertiary">{d}</p>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="grid min-h-[102px] grid-cols-7 border-b border-solid border-border-strong last:border-b-0">
            {week.map((day, i) => (
              <div key={i} className={`flex min-w-0 flex-col items-start gap-[4px] border-r border-solid border-border-soft px-[8px] pb-[6px] pt-[8px] last:border-r-0 ${day ? 'bg-surface' : 'bg-surface-subtle'}`}>
                {day === null ? null : day === todayDay ? (
                  <span className="flex size-[22px] items-center justify-center rounded-full bg-brand text-xs font-semibold text-fg-inverse">{day}</span>
                ) : (
                  <span className="text-sm leading-[1.2] text-fg-secondary">{day}</span>
                )}
                {day === null
                  ? null
                  : (chips.get(day) ?? []).map((c) => (
                      <span
                        key={c.programId}
                        title={`${c.title} · ${c.state}`}
                        className={`flex h-[20px] max-w-full items-center gap-[4px] rounded-xs px-[6px] text-2xs font-medium ${TONE[c.state]} ${c.programId === highlightId ? 'ring-1 ring-inset ring-current' : ''}`}
                      >
                        <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-current" />
                        <span className="truncate">{c.title}</span>
                      </span>
                    ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
