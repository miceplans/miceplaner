'use client';

import { useMemo, useState } from 'react';
import type { PublicEventDto } from '@miceplans/contracts/portal';
import { ClientHeader } from '@miceplans/ui';
import { usePortalPublicEvents } from '../../../lib/api/generated/endpoints';
import { eventColor } from '../../../lib/event-color';
import { calendarWeeks, eventsInMonth, eventWeekBars, formatRange, inclusiveDays, shortRange, todayIso, type WeekBar } from '../portal';

const A = '/assets/client/calendar-view';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 주 행: 날짜 줄 아래에 기간 막대를 줄(lane)마다 쌓는다. */
const BAR_TOP = 34;
const BAR_H = 20;
const BAR_GAP = 4;
const ROW_MIN = 102;

/** 조회 실패 시 쓰는 고정 빈 목록. 렌더마다 새 배열을 만들면 useMemo가 매번 다시 계산된다. */
const NO_EVENTS: PublicEventDto[] = [];

/**
 * 공개 캘린더 (명세 F-07). 로그인 여부와 관계없이 누구나 열 수 있고,
 * 내부 행사 상세에서 `공개 캘린더`를 켠 행사의 행사명·기간을 행사마다 지정된 대표색으로 보여 준다.
 */
export default function ClientCalendarPage() {
  const query = usePortalPublicEvents({ query: { staleTime: 60_000 } });
  const events = query.data ?? (query.isError ? NO_EVENTS : null);
  const error = query.error ? (query.error instanceof Error && query.error.message) || '공개 일정을 불러오지 못했습니다.' : null;
  const today = todayIso();
  const [todayYear, todayMonth] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth });

  const weeks = useMemo(() => calendarWeeks(cursor.year, cursor.month), [cursor]);
  const bars = useMemo(() => eventWeekBars(events ?? [], cursor.year, cursor.month, today), [events, cursor, today]);
  const monthEvents = useMemo(() => eventsInMonth(events ?? [], cursor.year, cursor.month), [events, cursor]);
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;
  const todayDay = Number(today.slice(8, 10));

  const shiftMonth = (delta: number) => {
    setCursor(({ year, month }) => {
      const next = new Date(year, month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };
  const goToday = () => setCursor({ year: todayYear, month: todayMonth });

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader
        action={
          <a href="/client/login" className="flex h-[34px] items-center rounded-sm bg-brand px-[14px] text-sm font-medium text-fg-inverse no-underline hover:opacity-90">
            로그인
          </a>
        }
      />
      <main className="relative flex min-h-px flex-1 flex-col items-start bg-surface px-[32px] max-md:px-0">
        <h1 className="w-full shrink-0 px-[24px] pt-[20px] text-lg font-semibold text-fg">행사 일정</h1>
        <div className="flex min-h-[44px] w-full shrink-0 flex-wrap items-center gap-[10px] px-[24px] py-[8px]">
          <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)} className="cursor-pointer border-0 bg-transparent p-0">
            <img alt="" src={`${A}/nav-icon.svg`} className="size-[15px]" />
          </button>
          <p className="whitespace-nowrap text-lg font-semibold text-fg">{cursor.year}년 {cursor.month}월</p>
          <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)} className="cursor-pointer border-0 bg-transparent p-0">
            <img alt="" src={`${A}/nav-icon1.svg`} className="size-[15px]" />
          </button>
          <button type="button" onClick={goToday} className="h-[26px] cursor-pointer rounded-sm border-0 bg-brand px-[10px] text-xs font-medium text-fg-inverse hover:opacity-90">
            Today
          </button>
        </div>
        <div className="flex w-full flex-1 flex-col gap-[24px] px-[24px] pb-[24px]">
          <div className="w-full overflow-x-auto">
            <div className="flex min-w-[720px] flex-col items-start">
              <div className="grid h-[32px] w-full shrink-0 grid-cols-7 border-b border-solid border-border bg-surface">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="flex h-full items-center justify-center">
                    <p className="whitespace-nowrap text-xs font-medium text-fg-tertiary">{d}</p>
                  </div>
                ))}
              </div>
              {weeks.map((week, w) => {
                const weekBars = bars[w] ?? [];
                const lanes = weekBars.reduce((n, b) => Math.max(n, b.lane + 1), 0);
                const height = Math.max(ROW_MIN, BAR_TOP + lanes * (BAR_H + BAR_GAP) + 6);
                return (
                  <div key={w} style={{ height }} className="relative grid w-full shrink-0 grid-cols-7 border-b border-l border-solid border-border-strong">
                    {week.map((day, i) => {
                      const isToday = isCurrentMonth && day === todayDay;
                      return (
                        <div
                          key={i}
                          className={`flex h-full min-w-0 flex-col items-start overflow-hidden border-r border-solid border-border-soft px-[8px] pt-[8px] ${
                            i === 6 ? 'border-r-border-strong' : ''
                          } ${day ? 'bg-surface' : 'bg-surface-subtle'}`}
                        >
                          {isToday ? (
                            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-semibold text-fg-inverse">{day}</span>
                          ) : day ? (
                            <p className="shrink-0 whitespace-nowrap text-sm text-fg-secondary">{day}</p>
                          ) : null}
                        </div>
                      );
                    })}
                    {weekBars.length > 0 ? (
                      <div className="pointer-events-none absolute inset-x-0 grid grid-cols-7 px-[2px]" style={{ top: BAR_TOP, gridAutoRows: BAR_H, rowGap: BAR_GAP }}>
                        {weekBars.map((b) => (
                          <EventBar key={b.eventId} bar={b} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {monthEvents.length > 0 ? (
            <section className="flex w-full flex-col gap-[8px]">
              <h2 className="text-base font-semibold text-fg">{cursor.month}월 행사</h2>
              <ul className="flex w-full flex-col divide-y divide-border-soft rounded-md border border-solid border-border-soft bg-surface">
                {monthEvents.map((e) => {
                  return (
                    <li key={e.eventId} className="flex items-center gap-[10px] px-[16px] py-[12px] max-md:flex-col max-md:items-start max-md:gap-[4px]">
                      <span className="flex min-w-0 flex-1 items-center gap-[8px]">
                        <span aria-hidden style={{ backgroundColor: eventColor(e.color, e.eventId) }} className="size-[8px] shrink-0 rounded-full" />
                        <span className="truncate text-sm font-medium text-fg">{e.name}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm text-fg-secondary">
                        {formatRange(e.startDate, e.endDate)} <span className="text-xs text-fg-tertiary">({inclusiveDays(e.startDate, e.endDate)}일)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {error ? <p role="alert" className="flex w-full justify-center text-sm text-error-delay">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}

/** 행사 기간 막대. 행사에 지정된 대표색으로 칠하고, 이 주 밖으로 이어지는 쪽은 모서리를 펴서 이어짐을 보여 준다. */
function EventBar({ bar }: { bar: WeekBar }) {
  return (
    <div
      title={`${bar.name} · ${formatRange(bar.startDate, bar.endDate)}`}
      className={`pointer-events-auto mx-[2px] flex min-w-0 items-center gap-[4px] px-[6px] text-fg-inverse ${bar.continuesBefore ? 'rounded-l-none' : 'rounded-l-xs'} ${
        bar.continuesAfter ? 'rounded-r-none' : 'rounded-r-xs'
      }`}
      style={{ gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 1, backgroundColor: eventColor(bar.color, bar.eventId) }}
    >
      <span className="truncate text-2xs font-semibold">{bar.name}</span>
      <span className="shrink-0 whitespace-nowrap text-2xs opacity-90">{shortRange(bar.startDate, bar.endDate)}</span>
    </div>
  );
}
