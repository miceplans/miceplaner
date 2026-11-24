'use client';

import { useMemo, useState } from 'react';
import { ClientShell, portalStateTone, type PortalState } from '@miceplans/ui';
import { calendarWeeks, chipsByDay, todayIso } from '../portal';
import { usePortalData } from '../use-portal-data';

/** 내부 일정 달력(MonthCalendar)과 같은 화살표 자산. */
const S = '/assets/schedule';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const LEGEND: PortalState[] = ['진행중', '예정', '완료'];

/** 지정된 행사의 Program 일정을 달력으로 본다. 지연 상태는 Client에게 노출하지 않는다 (명세 F-07). */
export default function ClientCalendarPage() {
  const { programs, error } = usePortalData();
  const today = todayIso();
  const [todayYear, todayMonth] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth });

  const weeks = useMemo(() => calendarWeeks(cursor.year, cursor.month), [cursor]);
  const chips = useMemo(() => chipsByDay(programs ?? [], cursor.year, cursor.month, today), [programs, cursor, today]);
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;
  const todayDay = Number(today.slice(8, 10));

  const shiftMonth = (delta: number) => {
    setCursor(({ year, month }) => {
      const next = new Date(year, month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };

  const legend = (
    <ul className="flex items-center gap-[14px]">
      {LEGEND.map((state) => (
        <li key={state} className="flex items-center gap-[5px]">
          <span className="size-[7px] rounded-full" style={{ background: portalStateTone(state).fg }} />
          <span className="whitespace-nowrap text-xs text-fg-secondary">{state}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <ClientShell active="calendar" title="캘린더" actions={legend}>
      <div className="flex w-full flex-col items-center gap-[24px]">
        <div className="flex shrink-0 items-center gap-[18px]">
          <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)} className="size-[27px] rounded-sm hover:bg-surface-chip">
            <img alt="" src={`${S}/4f176.svg`} className="size-full" />
          </button>
          <p className="whitespace-nowrap text-3xl font-semibold text-fg max-md:text-xl">
            {cursor.year}년 {cursor.month}월
          </p>
          <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)} className="size-[27px] rounded-sm hover:bg-surface-chip">
            <img alt="" src={`${S}/2e379.svg`} className="size-full" />
          </button>
        </div>

        <div className="w-full overflow-x-auto pb-[8px]">
          <div className="min-w-[720px]">
            <div className="grid h-[32px] w-full grid-cols-7">
              {WEEKDAYS.map((d) => (
                <div key={d} className="flex items-center justify-center text-xs font-medium text-fg-tertiary">{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid h-[102px] w-full grid-cols-7 border-b border-solid border-border-strong">
                {week.map((day, ci) => {
                  const dayChips = day ? (chips.get(day) ?? []) : [];
                  const isToday = isCurrentMonth && day === todayDay;
                  return (
                    <div
                      key={ci}
                      className={`flex h-full min-w-0 flex-col items-start gap-[4px] overflow-hidden border-r border-solid border-border-soft px-[8px] pb-[6px] pt-[8px] ${
                        ci === 0 ? 'border-l' : ''
                      } ${wi === 0 ? 'border-t' : ''} ${day ? 'bg-surface' : 'bg-surface-subtle'}`}
                    >
                      {isToday ? (
                        <span className="flex shrink-0 items-center gap-[4px]">
                          <span className="flex size-[22px] items-center justify-center rounded-lg bg-brand text-xs font-semibold text-fg-inverse">{day}</span>
                          <span className="text-2xs font-medium text-fg-tertiary">({WEEKDAYS[ci]})</span>
                        </span>
                      ) : day ? (
                        <span className="shrink-0 whitespace-nowrap text-sm text-fg-secondary">
                          {day} <span className="text-2xs text-fg-tertiary">({WEEKDAYS[ci]})</span>
                        </span>
                      ) : null}
                      {dayChips.map((c) => {
                        const tone = portalStateTone(c.state);
                        return (
                          <div
                            key={c.programId}
                            title={c.title}
                            className="flex h-[20px] w-full shrink-0 items-center gap-[4px] rounded-xs px-[6px]"
                            style={{ background: tone.bg }}
                          >
                            <span className="size-[5px] shrink-0 rounded-full" style={{ background: tone.fg }} />
                            <span className="truncate text-2xs font-medium" style={{ color: tone.fg }}>{c.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-error-delay">{error}</p>
        ) : programs !== null && chips.size === 0 ? (
          <p className="text-sm text-fg-tertiary">이 달에 공유된 일정이 없습니다</p>
        ) : null}
      </div>
    </ClientShell>
  );
}
