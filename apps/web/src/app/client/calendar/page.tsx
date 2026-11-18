'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClientHeader } from '@miceplans/ui';
import type { PortalProgramDto } from '@miceplans/contracts/portal';
import { listPortalPrograms } from '../../../lib/api';
import { calendarWeeks, chipsByDay, todayIso, type ScheduleState } from '../portal';

const A = '/assets/client/calendar-view';

const TONE: Record<ScheduleState, { bg: string; fg: string; dot: string }> = {
  예정: { bg: 'bg-info-bg', fg: 'text-brand-blue', dot: 'dot6' },
  진행중: { bg: 'bg-notice-bg', fg: 'text-notice', dot: 'dot7' },
  완료: { bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: 'dot4' },
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const LEGEND: [ScheduleState, string][] = [
  ['진행중', '진행중'],
  ['예정', '예정'],
  ['완료', '완료'],
];

/** 지정된 행사의 Program 일정을 달력으로 본다. 지연 상태는 Client에게 노출하지 않는다 (명세 F-07). */
export default function ClientCalendarPage() {
  const [programs, setPrograms] = useState<PortalProgramDto[] | null>(null);
  const today = todayIso();
  const [todayYear, todayMonth] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth });

  useEffect(() => {
    let alive = true;
    listPortalPrograms().then((rows) => { if (alive) setPrograms(rows); }).catch(() => { if (alive) setPrograms([]); });
    return () => { alive = false; };
  }, []);

  const weeks = useMemo(() => calendarWeeks(cursor.year, cursor.month), [cursor]);
  const chips = useMemo(
    () => chipsByDay(programs ?? [], cursor.year, cursor.month, today),
    [programs, cursor, today],
  );
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;
  const todayDay = Number(today.slice(8, 10));

  const shiftMonth = (delta: number) => {
    setCursor(({ year, month }) => {
      const next = new Date(year, month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };

  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <ClientHeader active="calendar" />
      <main className="relative flex min-h-px flex-1 flex-col items-start bg-surface px-[32px]">
        <div className="flex h-[52px] w-full shrink-0 items-center px-[24px]">
          <div className="flex h-full items-start gap-[2px]">
            <a href="/client/events" className="flex h-full items-center gap-[7px] px-[12px]">
              <img alt="" src={`${A}/tab-icon.svg`} className="size-[15px]" />
              <span className="whitespace-nowrap text-base text-fg-secondary">행사 뷰</span>
            </a>
            <a href="/client/calendar" className="flex h-full items-center gap-[7px] px-[12px]">
              <img alt="" src={`${A}/tab-icon1.svg`} className="size-[15px]" />
              <span className="whitespace-nowrap text-base font-medium text-brand">캘린더 뷰</span>
            </a>
          </div>
        </div>
        <div className="flex h-[44px] w-full shrink-0 items-center gap-[10px] px-[24px]">
          <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)} className="cursor-pointer border-0 bg-transparent p-0">
            <img alt="이전 달" src={`${A}/nav-icon.svg`} className="size-[15px]" />
          </button>
          <p className="whitespace-nowrap text-lg font-semibold text-fg">{cursor.year}년 {cursor.month}월</p>
          <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)} className="cursor-pointer border-0 bg-transparent p-0">
            <img alt="다음 달" src={`${A}/nav-icon1.svg`} className="size-[15px]" />
          </button>
          <div className="h-px min-w-px flex-1" />
          <ul className="flex h-full items-center gap-[14px]">
            {LEGEND.map(([state, label]) => (
              <li key={state} className="flex h-full items-center gap-[5px]">
                <img alt="" src={`${A}/${TONE[state].dot}.svg`} className="size-[7px]" />
                <span className="whitespace-nowrap text-xs text-fg-secondary">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-h-px w-full flex-1 flex-col items-start px-[24px] pb-[24px]">
          <div className="flex h-[32px] w-full shrink-0 items-start border-b border-solid border-border bg-surface">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`flex h-full items-center justify-center ${i === 6 ? 'w-[164.5px] shrink-0' : 'min-w-px flex-1'}`}
              >
                <p className="whitespace-nowrap text-xs font-medium text-fg-tertiary">{d}</p>
              </div>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div
              key={w}
              className={`flex h-[102px] w-full shrink-0 items-start border-solid border-border-strong ${w === weeks.length - 1 ? 'border' : 'border-b'}`}
            >
              {week.map((day, i) => {
                const dayChips = day ? (chips.get(day) ?? []) : [];
                const last = i === 6;
                const isToday = isCurrentMonth && day === todayDay;
                return (
                  <div
                    key={i}
                    className={`flex h-full flex-col items-start gap-[4px] overflow-hidden border-solid border-border-soft px-[8px] pb-[6px] pt-[8px] ${
                      last ? 'w-[164.5px] shrink-0 border' : 'min-w-px flex-1 border-r'
                    } ${day ? 'bg-surface' : 'bg-surface-subtle'}`}
                  >
                    {isToday ? (
                      <span className="flex shrink-0 items-center gap-[4px]">
                        <span className="flex size-[22px] items-center justify-center rounded-lg bg-brand text-xs font-semibold text-fg-inverse">
                          {day}
                        </span>
                        <span className="text-2xs font-medium text-fg-tertiary">({WEEKDAYS[i]})</span>
                      </span>
                    ) : day ? (
                      <p className="shrink-0 whitespace-nowrap text-sm text-fg-secondary">
                        {day} <span className="text-2xs text-fg-tertiary">({WEEKDAYS[i]})</span>
                      </p>
                    ) : null}
                    {dayChips.map((c) => {
                      const t = TONE[c.state];
                      return (
                        <div key={c.programId} className={`flex h-[20px] max-w-full shrink-0 items-center gap-[4px] rounded-xs px-[6px] ${t.bg}`}>
                          <img alt="" src={`${A}/${t.dot}.svg`} className="size-[5px] shrink-0" />
                          <p className={`truncate whitespace-nowrap text-2xs font-medium ${t.fg}`}>{c.title}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
          {programs !== null && chips.size === 0 ? (
            <p className="flex w-full justify-center pt-[16px] text-sm text-fg-tertiary">이 달에 공유된 일정이 없습니다</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
