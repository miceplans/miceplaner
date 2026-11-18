'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClientHeader } from '@miceplans/ui';
import type { PortalEventDto, PortalProgramDto } from '@miceplans/contracts/portal';
import { listPortalEvents, listPortalPrograms } from '../../../lib/api';
import {
  ddayLabel,
  daysUntil,
  eventState,
  formatDate,
  formatRange,
  nearestEvent,
  programState,
  sortPrograms,
  todayIso,
  type ScheduleState,
} from '../portal';

const A = '/assets/client/dashboard';

const STATE_TONE: Record<ScheduleState, string> = {
  예정: 'bg-brand-tint text-brand',
  진행중: 'bg-brand text-fg-inverse',
  완료: 'bg-surface-chip text-fg-secondary',
};

function StatePill({ state }: { state: ScheduleState }) {
  return (
    <span className={`flex h-[22px] shrink-0 items-center justify-center rounded-lg px-[9px] text-2xs font-semibold ${STATE_TONE[state]}`}>
      {state}
    </span>
  );
}

/** Client 대시보드. 명세 F-07 범위(행사·Program 일정) 데이터로만 구성한다. */
export default function ClientDashboardPage() {
  const [events, setEvents] = useState<PortalEventDto[] | null>(null);
  const [programs, setPrograms] = useState<PortalProgramDto[] | null>(null);
  const today = todayIso();

  useEffect(() => {
    let alive = true;
    listPortalEvents().then((rows) => { if (alive) setEvents(rows); }).catch(() => { if (alive) setEvents([]); });
    listPortalPrograms().then((rows) => { if (alive) setPrograms(rows); }).catch(() => { if (alive) setPrograms([]); });
    return () => { alive = false; };
  }, []);

  const eventName = useMemo(() => {
    if (!events || !programs) return new Map<string, string>();
    return new Map(events.map((e) => [e.eventId, e.name]));
  }, [events, programs]);

  const loading = events === null || programs === null;
  const sortedEvents = useMemo(() => (events ? [...events].sort((a, b) => a.startDate.localeCompare(b.startDate)) : []), [events]);
  const focus = nearestEvent(sortedEvents, today);
  const focusPrograms = useMemo(
    () => (focus && programs ? sortPrograms(programs.filter((p) => p.eventId === focus.eventId)) : []),
    [focus, programs],
  );

  /** 다가오는 일정: 오늘 이후 마감·시작 Program. */
  const upcoming = useMemo(() => {
    if (!programs) return [];
    return sortPrograms(programs.filter((p) => (p.dueOn ?? p.startsOn ?? '') >= today)).slice(0, 5);
  }, [programs, today]);

  const thisMonth = useMemo(() => {
    if (!programs) return [];
    const prefix = today.slice(0, 7);
    return sortPrograms(programs.filter((p) => (p.startsOn ?? p.dueOn ?? '').startsWith(prefix))).slice(0, 4);
  }, [programs, today]);

  const upcomingDday = (p: PortalProgramDto): string | null => {
    const start = p.startsOn ?? p.dueOn;
    if (!start) return null;
    const state = programState(p.startsOn, p.dueOn, today);
    if (state === '완료') return '완료';
    if (state === '진행중') return '진행중';
    return `D-${daysUntil(start, today)}`;
  };

  const donePrograms = focusPrograms.filter((p) => programState(p.startsOn, p.dueOn, today) === '완료').length;
  const steps = focusPrograms.slice(0, 5);
  const hiddenPrograms = focusPrograms.length - steps.length;

  return (
    <div className="flex min-h-[860px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px flex-1 items-start px-[40px] pb-[36px] pt-[40px]">
        <div className="flex w-[1361px] flex-col items-center gap-[22px]">
          <div className="flex w-full items-center gap-[22px]">
            <a
              href="/client/events"
              className="flex min-h-[260px] w-[575px] shrink-0 flex-col items-end justify-between rounded-2xl bg-brand-pink px-[53.077px] py-[35.385px]"
            >
              <p className="w-full text-3xl font-semibold text-fg-inverse">행사</p>
              <div className="flex w-full items-end justify-between gap-[8px]">
                <div className="flex flex-col gap-[6px]">
                  {focus ? (
                    <>
                      <p className="whitespace-nowrap text-2xl font-semibold text-fg-inverse">{focus.name}</p>
                      <p className="whitespace-nowrap text-md text-fg-inverse/80">
                        {formatRange(focus.startDate, focus.endDate)} · {ddayLabel(focus.startDate, focus.endDate, today)}
                      </p>
                    </>
                  ) : (
                    <p className="whitespace-nowrap text-md text-fg-inverse/80">{loading ? '불러오는 중…' : '지정된 행사가 없습니다'}</p>
                  )}
                </div>
                <div className="flex items-center gap-[8px]">
                  <p className="whitespace-nowrap text-2xl font-semibold text-fg-inverse">바로가기</p>
                  <img alt="" src={`${A}/frame133.svg`} className="size-[31.096px]" />
                </div>
              </div>
            </a>

            <section className="flex min-h-[260px] w-[371px] shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
              <div className="flex w-full items-center gap-[8px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">다가오는 일정</h2>
                <a href="/client/calendar" className="flex items-center gap-[4px] py-[4px]">
                  <span className="whitespace-nowrap text-2xs font-medium text-brand">캘린더 보기</span>
                  <img alt="" src={`${A}/chevron-right.svg`} className="size-[12px]" />
                </a>
              </div>
              <ul className="flex w-full flex-col gap-[4px]">
                {loading ? (
                  <li className="flex h-[44px] w-full items-center text-sm text-fg-tertiary">불러오는 중…</li>
                ) : upcoming.length === 0 ? (
                  <li className="flex h-[44px] w-full items-center text-sm text-fg-tertiary">다가오는 일정이 없습니다</li>
                ) : (
                  upcoming.map((p) => {
                    const when = p.startsOn ?? p.dueOn;
                    const dday = upcomingDday(p);
                    return (
                      <li key={p.programId} className="flex min-h-[44px] w-full items-center gap-[12px]">
                        <p className="w-[52px] shrink-0 whitespace-nowrap text-lg font-semibold text-fg">
                          {when ? formatDate(when).slice(5) : '미정'}
                        </p>
                        <div className="flex min-w-px flex-1 flex-col gap-[2px] whitespace-nowrap">
                          <p className="text-sm text-fg">{p.title}</p>
                          <p className="text-2xs text-fg-tertiary">{eventName.get(p.eventId) ?? ''}</p>
                        </div>
                        {dday ? (
                          <span
                            className={`flex h-[22px] shrink-0 items-center justify-center rounded-lg px-[9px] text-2xs font-semibold ${
                              dday === '진행중' ? 'bg-brand text-fg-inverse' : dday === '완료' ? 'bg-surface-chip text-fg-secondary' : 'bg-brand-tint text-brand'
                            }`}
                          >
                            {dday}
                          </span>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </section>

            <section className="flex min-h-[260px] w-[371px] shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
              <div className="flex w-full items-center gap-[8px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">내 행사 현황</h2>
                <a href="/client/events" className="flex items-center gap-[4px] py-[4px]">
                  <span className="whitespace-nowrap text-2xs font-medium text-brand">전체 보기</span>
                  <img alt="" src={`${A}/chevron-right.svg`} className="size-[12px]" />
                </a>
              </div>
              <ul className="flex w-full flex-col gap-[2px]">
                {loading ? (
                  <li className="flex h-[36px] w-full items-center text-sm text-fg-tertiary">불러오는 중…</li>
                ) : sortedEvents.length === 0 ? (
                  <li className="flex h-[36px] w-full items-center text-sm text-fg-tertiary">지정된 행사가 없습니다</li>
                ) : (
                  sortedEvents.slice(0, 5).map((e) => (
                    <li key={e.eventId} className="flex min-h-[36px] w-full items-center justify-between gap-[8px]">
                      <a href={`/client/events/${e.eventId}`} className="min-w-px flex-1 truncate text-sm text-fg">
                        {e.name}
                      </a>
                      <StatePill state={eventState(e.startDate, e.endDate, today)} />
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="flex w-[1347px] items-stretch gap-[22px]">
            <section className="flex min-h-[438px] w-[959px] shrink-0 flex-col items-start gap-[18.781px] rounded-2xl bg-surface px-[37.562px] py-[21.911px]">
              <h2 className="whitespace-nowrap text-3xl font-semibold text-fg">행사 진행 단계</h2>
              {focus ? (
                <>
                  <p className="whitespace-nowrap text-md text-fg-secondary">
                    {focus.name} · 프로그램 {donePrograms}/{focusPrograms.length} 완료
                  </p>
                  <div className="flex h-[68.864px] shrink-0 flex-col items-center">
                    <div className="flex w-[763px] items-center">
                      {steps.map((p, i) => {
                        const state = programState(p.startsOn, p.dueOn, today);
                        const stepState = state === '완료' ? 'done' : state === '진행중' ? 'current' : 'todo';
                        return (
                          <div key={p.programId} className="contents">
                            {i > 0 ? (
                              <div className={`h-[3.13px] min-w-px flex-1 rounded-xs ${programState(steps[i - 1]!.startsOn, steps[i - 1]!.dueOn, today) === '완료' ? 'bg-brand' : 'bg-border-placeholder'}`} />
                            ) : null}
                            <div className="flex size-[37.562px] shrink-0 flex-col items-center gap-[6.26px]">
                              <div
                                className={`flex size-[37.562px] shrink-0 items-center justify-center rounded-2xl ${
                                  stepState === 'todo' ? 'border-[1.565px] border-solid border-border-placeholder bg-surface' : 'bg-brand'
                                }`}
                              >
                                {stepState === 'done' ? (
                                  <img alt="" src={`${A}/check.svg`} className="size-[18.781px]" />
                                ) : (
                                  <p className={`text-lg ${stepState === 'current' ? 'font-semibold text-fg-inverse' : 'text-border-placeholder'}`}>
                                    {i + 1}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <ul className="flex w-[763px] flex-col gap-[6px]">
                    {steps.map((p, i) => {
                      const when = p.startsOn ?? p.dueOn;
                      return (
                        <li key={p.programId} className="flex w-full items-center gap-[10px] whitespace-nowrap">
                          <p className="w-[20px] shrink-0 text-sm font-semibold text-fg-tertiary">{i + 1}</p>
                          <p className="min-w-px flex-1 truncate text-sm text-fg">{p.title}</p>
                          <p className="shrink-0 text-2xs text-fg-tertiary">{when ? formatDate(when) : '일정 미정'}</p>
                          <StatePill state={programState(p.startsOn, p.dueOn, today) ?? '예정'} />
                        </li>
                      );
                    })}
                    {hiddenPrograms > 0 ? (
                      <li className="text-2xs font-medium text-brand">
                        <a href={`/client/events/${focus.eventId}`}>+ {hiddenPrograms}개 더 보기</a>
                      </li>
                    ) : null}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-fg-tertiary">{loading ? '불러오는 중…' : '표시할 행사가 없습니다'}</p>
              )}
              <div className="relative h-[178.188px] w-[324.373px] shrink-0">
                <img alt="" src={`${A}/group23.svg`} className="absolute inset-0 size-full max-w-none" />
                {focus && focusPrograms.length > 0 ? (
                  <p className="absolute left-0 top-[107.99px] w-full whitespace-nowrap text-center text-3xl font-bold tracking-[1.5651px] text-fg">
                    {Math.round((donePrograms / focusPrograms.length) * 100)}%
                  </p>
                ) : null}
              </div>
            </section>

            <div className="flex w-[371px] shrink-0 flex-col gap-[22px]">
              <section className="flex min-h-[150px] w-full shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">행사 정보</h2>
                {focus ? (
                  <dl className="flex w-full flex-col gap-[10px]">
                    <div className="flex w-full items-center gap-[10px]">
                      <dt className="w-[52px] shrink-0 text-2xs text-fg-tertiary">기간</dt>
                      <dd className="whitespace-nowrap text-md text-fg">{formatRange(focus.startDate, focus.endDate)}</dd>
                    </div>
                    <div className="flex w-full items-center gap-[10px]">
                      <dt className="w-[52px] shrink-0 text-2xs text-fg-tertiary">장소</dt>
                      <dd className="whitespace-nowrap text-md text-fg">{focus.place || '장소 미정'}</dd>
                    </div>
                    <div className="flex w-full items-center gap-[10px]">
                      <dt className="w-[52px] shrink-0 text-2xs text-fg-tertiary">D-day</dt>
                      <dd className="whitespace-nowrap text-md text-fg">{ddayLabel(focus.startDate, focus.endDate, today)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-fg-tertiary">{loading ? '불러오는 중…' : '표시할 행사가 없습니다'}</p>
                )}
              </section>
              <section className="flex min-h-[260px] w-full shrink-0 flex-col items-start justify-between rounded-2xl bg-surface p-[24px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">이번 달 일정</h2>
                <ul className="flex w-full flex-col">
                  {loading ? (
                    <li className="flex min-h-[40px] w-full items-center text-sm text-fg-tertiary">불러오는 중…</li>
                  ) : thisMonth.length === 0 ? (
                    <li className="flex min-h-[40px] w-full items-center text-sm text-fg-tertiary">이번 달 공유된 일정이 없습니다</li>
                  ) : (
                    thisMonth.map((p) => {
                      const when = p.startsOn ?? p.dueOn!;
                      return (
                        <li key={p.programId} className="flex min-h-[40px] w-full items-center gap-[10px]">
                          <p className="w-[52px] shrink-0 whitespace-nowrap text-sm font-semibold text-fg">{formatDate(when).slice(5)}</p>
                          <div className="flex min-w-px flex-1 flex-col gap-px">
                            <p className="truncate whitespace-nowrap text-sm text-fg">{p.title}</p>
                            <p className="truncate whitespace-nowrap text-2xs text-fg-tertiary">{eventName.get(p.eventId) ?? ''}</p>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
