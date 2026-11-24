'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { PublicEventDto } from '@miceplans/contracts/portal';
import { ClientShell, portalStateTone, type PortalState } from '@miceplans/ui';
import { getToken } from '../../../lib/api';
import { usePortalPublicEvents } from '../../../lib/api/generated/endpoints';
import { calendarWeeks, chipsByDay, publicEventChipsByDay, todayIso } from '../portal';
import { usePortalData } from '../use-portal-data';

/** 내부 일정 달력(MonthCalendar)과 같은 화살표 자산. */
const S = '/assets/schedule';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const LEGEND: PortalState[] = ['진행중', '예정', '완료'];

const noSubscribe = () => () => {};
/** 조회 실패 시 쓰는 고정 빈 목록. 렌더마다 새 배열을 만들면 useMemo가 매번 다시 계산된다. */
const NO_EVENTS: PublicEventDto[] = [];

/**
 * 세션 토큰 유무. 정적 export의 서버 렌더에서는 알 수 없으므로 null이다.
 * 토큰의 유효성은 API가 확인하며(401이면 로그인으로 이동) 이 값은 화면 분기용이다.
 */
function useSignedIn(): boolean | null {
  return useSyncExternalStore(noSubscribe, () => getToken() !== null, () => null);
}

/**
 * 포털 캘린더 (명세 F-07). 로그인하지 않으면 공개 표시한 회사 행사의 행사명·기간을,
 * 로그인한 Client에게는 지정된 행사의 Program 일정만 보여 준다. 지연 상태는 Client에게 노출하지 않는다.
 */
export default function ClientCalendarPage() {
  const signedIn = useSignedIn();
  const { programs: myPrograms, error: myError } = usePortalData({ enabled: signedIn === true });
  const publicQuery = usePortalPublicEvents({ query: { enabled: signedIn === false } });
  const publicEvents = publicQuery.data ?? (publicQuery.isError ? NO_EVENTS : null);
  const loaded = signedIn ? myPrograms !== null : publicEvents !== null;
  const error = signedIn ? myError : publicQuery.error ? (publicQuery.error instanceof Error && publicQuery.error.message) || '공개 일정을 불러오지 못했습니다.' : null;
  const today = todayIso();
  const [todayYear, todayMonth] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const [cursor, setCursor] = useState({ year: todayYear, month: todayMonth });

  const weeks = useMemo(() => calendarWeeks(cursor.year, cursor.month), [cursor]);
  const chips = useMemo(
    () => (signedIn ? chipsByDay(myPrograms ?? [], cursor.year, cursor.month, today) : publicEventChipsByDay(publicEvents ?? [], cursor.year, cursor.month, today)),
    [signedIn, myPrograms, publicEvents, cursor, today],
  );
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;
  const todayDay = Number(today.slice(8, 10));

  const shiftMonth = (delta: number) => {
    setCursor(({ year, month }) => {
      const next = new Date(year, month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };

  const legend = (
    <div className="flex flex-wrap items-center gap-[14px]">
      <ul className="flex items-center gap-[14px]">
        {LEGEND.map((state) => (
          <li key={state} className="flex items-center gap-[5px]">
            <span className="size-[7px] rounded-full" style={{ background: portalStateTone(state).fg }} />
            <span className="whitespace-nowrap text-xs text-fg-secondary">{state}</span>
          </li>
        ))}
      </ul>
      {signedIn === false ? (
        <a href="/client/login" className="flex h-[32px] items-center rounded-sm bg-brand px-[14px] text-sm font-medium text-fg-inverse hover:opacity-90">
          로그인
        </a>
      ) : null}
    </div>
  );

  return (
    <ClientShell active="calendar" title={signedIn === false ? '행사 일정' : '캘린더'} actions={legend}>
      <div className="flex w-full flex-col items-center gap-[24px]">
        {signedIn === false ? (
          <p className="w-full text-sm text-fg-secondary">마이스 플랜즈가 진행하는 행사 일정입니다. 로그인하면 내 행사의 프로그램 일정만 볼 수 있습니다.</p>
        ) : null}
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
        ) : loaded && chips.size === 0 ? (
          <p className="text-sm text-fg-tertiary">{signedIn ? '이 달에 공유된 일정이 없습니다' : '이 달에 공개된 행사가 없습니다'}</p>
        ) : null}
      </div>
    </ClientShell>
  );
}
