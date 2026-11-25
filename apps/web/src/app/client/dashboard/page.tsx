'use client';

import { useMemo } from 'react';
import { ClientHeader } from '@miceplans/ui';
import type { PortalProgramDto } from '@miceplans/contracts/portal';
import {
  daysUntil,
  formatDate,
  formatMonthDay,
  formatPeriod,
  inclusiveDays,
  nearestEvent,
  programState,
  sortPrograms,
  stepWindowStart,
  todayIso,
} from '../portal';
import { ScheduleStatus } from '../schedule-status';
import { eventDetailHref, usePortalData } from '../use-portal-data';
import { ProgressGauge } from './progress-gauge';

const A = '/assets/client/dashboard';

const CARD = 'flex min-w-0 flex-col rounded-2xl bg-surface p-[24px]';
const CARD_TITLE = 'whitespace-nowrap text-xl font-bold leading-[1.2] text-fg';
const EMPTY = 'text-sm text-fg-tertiary';

const PREP_COUNT = 4;
const UPCOMING_COUNT = 3;
const MONTH_COUNT = 3;
const STEP_COUNT = 5;
/** 이 일수 이하로 남은 일정은 D-day 필을 채워서 강조한다. */
const URGENT_DAYS = 5;

/** Client 대시보드 (Figma 157:5395). 명세 F-07 범위(행사·Program 일정) 데이터로만 구성한다. */
export default function ClientDashboardPage() {
  const { events, programs, error } = usePortalData();
  const today = todayIso();

  const eventById = useMemo(() => new Map((events ?? []).map((e) => [e.eventId, e])), [events]);
  const loading = events === null || programs === null;
  const focus = useMemo(() => nearestEvent(events ?? [], today), [events, today]);
  const focusPrograms = useMemo(
    () => (focus && programs ? sortPrograms(programs.filter((p) => p.eventId === focus.eventId)) : []),
    [focus, programs],
  );

  /** 준비 항목: 아직 끝나지 않은 항목이 보이도록 완료 항목은 직전 하나만 남긴다. */
  const done = focusPrograms.map((p) => programState(p.startsOn, p.dueOn, today) === '완료');
  const doneCount = done.filter(Boolean).length;
  const prepStart = stepWindowStart(done, PREP_COUNT);
  const prep = focusPrograms.slice(prepStart, prepStart + PREP_COUNT);
  const stepStart = stepWindowStart(done, STEP_COUNT);
  const steps = focusPrograms.slice(stepStart, stepStart + STEP_COUNT);

  const upcoming = useMemo(
    () => sortPrograms((programs ?? []).filter((p) => (p.dueOn ?? p.startsOn ?? '') >= today)).slice(0, UPCOMING_COUNT),
    [programs, today],
  );
  const thisMonth = useMemo(() => {
    const prefix = today.slice(0, 7);
    return sortPrograms((programs ?? []).filter((p) => (p.startsOn ?? p.dueOn ?? '').startsWith(prefix))).slice(-MONTH_COUNT);
  }, [programs, today]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px w-full flex-1 justify-center p-[40px] max-md:px-[16px] max-md:py-[20px]">
        <div className="grid w-full max-w-[1361px] grid-cols-1 content-start gap-[22px] md:grid-cols-2 xl:grid-cols-[minmax(0,575fr)_minmax(0,371fr)_minmax(0,371fr)]">
          {error ? (
            <p role="alert" className="col-span-full w-full rounded-xl bg-error-bg px-[20px] py-[12px] text-sm text-error-delay">{error}</p>
          ) : null}

          <a
            href={focus ? eventDetailHref(focus.eventId) : '/client/events'}
            className="flex min-h-[260px] min-w-0 flex-col items-end justify-between gap-[16px] rounded-hero bg-brand-pink px-[53px] py-[35px] text-fg-inverse max-md:min-h-[200px] max-md:p-[24px] md:col-span-2 xl:col-span-1"
          >
            <p className="line-clamp-2 w-full break-keep text-hero font-semibold max-md:text-3xl">
              {focus ? focus.name : loading ? '불러오는 중…' : '예정된 행사가 없습니다'}
            </p>
            <span className="flex shrink-0 items-center gap-[8px]">
              <span className="whitespace-nowrap text-hero-cta font-semibold max-md:text-xl">바로가기</span>
              <img alt="" src={`${A}/frame133.svg`} className="size-[31.096px]" />
            </span>
          </a>

          <section className={`${CARD} min-h-[260px] justify-between gap-[16px]`}>
            <div className="flex w-full items-center gap-[8px]">
              <h2 className={CARD_TITLE}>준비 항목 현황</h2>
              <a href={focus ? eventDetailHref(focus.eventId) : '/client/events'} className="flex items-center gap-[4px] py-[4px]">
                <span className="whitespace-nowrap text-2xs font-medium text-brand">전체 보기</span>
                <img alt="" src={`${A}/chevron-right.svg`} className="size-[12px]" />
              </a>
            </div>
            {prep.length === 0 ? (
              <p className={EMPTY}>{loading ? '불러오는 중…' : '공유된 준비 항목이 없습니다'}</p>
            ) : (
              <ul className="flex w-full flex-col gap-[2px]">
                {prep.map((p) => (
                  <li key={p.programId} className="flex h-[36px] w-full items-center justify-between gap-[12px]">
                    <p className="min-w-0 flex-1 truncate text-sm text-fg">{p.title}</p>
                    <ScheduleStatus state={programState(p.startsOn, p.dueOn, today) ?? '예정'} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${CARD} min-h-[260px] justify-between gap-[16px]`}>
            <h2 className={CARD_TITLE}>다가오는 일정</h2>
            {upcoming.length === 0 ? (
              <p className={EMPTY}>{loading ? '불러오는 중…' : '다가오는 일정이 없습니다'}</p>
            ) : (
              <ul className="flex w-full flex-col gap-[4px]">
                {upcoming.map((p) => {
                  const event = eventById.get(p.eventId);
                  return (
                    <li key={p.programId} className="flex h-[44px] w-full items-center gap-[12px]">
                      <p className="min-w-[46px] shrink-0 whitespace-nowrap text-lg font-semibold text-fg">{formatMonthDay(p.startsOn ?? p.dueOn!)}</p>
                      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                        <p className="truncate text-sm leading-[1.2] text-fg">{p.title}</p>
                        <p className="truncate text-2xs leading-[1.2] text-fg-tertiary">{[event?.name, event?.place].filter(Boolean).join(' · ')}</p>
                      </div>
                      <DdayPill program={p} today={today} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex min-h-[438px] min-w-0 flex-col items-start gap-[18.781px] rounded-2xl bg-surface px-[37.562px] py-[21.911px] max-md:min-h-0 max-md:px-[20px] md:col-span-2">
            <h2 className="whitespace-nowrap text-3xl font-semibold text-fg">행사 진행 단계</h2>
            {steps.length === 0 ? (
              <p className={EMPTY}>{loading ? '불러오는 중…' : '공유된 프로그램 일정이 없습니다'}</p>
            ) : (
              <>
                <ol className="flex h-[69px] w-full max-w-[763px] shrink-0 items-start">
                  {steps.map((p, i) => (
                    <Step key={p.programId} program={p} today={today} number={stepStart + i + 1} first={i === 0} prevDone={i > 0 && done[stepStart + i - 1]!} />
                  ))}
                </ol>
                <ProgressGauge ratio={doneCount / focusPrograms.length} />
              </>
            )}
          </section>

          <div className="flex min-w-0 flex-col gap-[22px] md:col-span-2 xl:col-span-1">
            <section className={`${CARD} min-h-[150px] w-full shrink-0 justify-between gap-[16px]`}>
              <h2 className={CARD_TITLE}>행사 정보</h2>
              {focus ? (
                <dl className="flex w-full flex-col gap-[10px]">
                  <InfoRow label="기간" value={formatPeriod(focus.startDate, focus.endDate)} note={`${inclusiveDays(focus.startDate, focus.endDate)}일간`} icon="info" />
                  <InfoRow label="장소" value={focus.place || '장소 미정'} icon="info1" />
                </dl>
              ) : (
                <p className={EMPTY}>{loading ? '불러오는 중…' : '표시할 행사가 없습니다'}</p>
              )}
            </section>

            <section className={`${CARD} min-h-[260px] w-full shrink-0 justify-between gap-[16px]`}>
              <h2 className={CARD_TITLE}>이번 달 일정</h2>
              {thisMonth.length === 0 ? (
                <p className={EMPTY}>{loading ? '불러오는 중…' : '이번 달 공유된 일정이 없습니다'}</p>
              ) : (
                <ul className="flex w-full flex-col">
                  {thisMonth.map((p) => (
                    <li key={p.programId} className="flex w-full flex-col gap-[6px] p-[8px]">
                      <p className="truncate text-xs text-fg">{p.title}</p>
                      <p className="truncate text-2xs leading-[1.2] text-fg-tertiary">
                        {[eventById.get(p.eventId)?.name, formatDate(p.startsOn ?? p.dueOn!).slice(5)].filter(Boolean).join(' / ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function DdayPill({ program, today }: { program: PortalProgramDto; today: string }) {
  const ongoing = programState(program.startsOn, program.dueOn, today) === '진행중';
  const days = daysUntil(program.startsOn ?? program.dueOn!, today);
  return (
    <span
      className={`flex h-[22px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-[9px] text-2xs font-semibold ${
        ongoing || days <= URGENT_DAYS ? 'bg-brand text-fg-inverse' : 'bg-brand-tint text-brand'
      }`}
    >
      {ongoing ? '진행중' : `D-${days}`}
    </span>
  );
}

/** 진행 단계 한 칸. 앞 단계와 잇는 선, 번호 점, 점 아래 이름. */
function Step({ program, today, number, first, prevDone }: { program: PortalProgramDto; today: string; number: number; first: boolean; prevDone: boolean }) {
  const state = programState(program.startsOn, program.dueOn, today) ?? '예정';
  const dot = 'flex size-[37.562px] items-center justify-center rounded-full';
  return (
    <>
      {first ? null : <li aria-hidden className={`mt-[17.2px] h-[3.13px] min-w-px flex-1 rounded-full ${prevDone ? 'bg-brand' : 'bg-border-placeholder'}`} />}
      <li className="relative size-[37.562px] shrink-0" title={`${program.title} · ${state}`}>
        {state === '완료' ? (
          <span className={`${dot} bg-brand`}>
            <img alt="완료" src={`${A}/check.svg`} className="size-[18.781px]" />
          </span>
        ) : state === '진행중' ? (
          <span className={`${dot} bg-brand text-lg font-semibold text-fg-inverse`}>{number}</span>
        ) : (
          <span className={`${dot} border-[1.565px] border-solid border-border-placeholder bg-surface text-lg text-border-placeholder`}>{number}</span>
        )}
        {/* 첫 이름은 점 왼쪽에 맞춰 카드 안쪽 여백을 지킨다. 점보다 짧으면 Figma처럼 점 가운데에 온다. */}
        <p
          className={`absolute top-full mt-[6px] line-clamp-2 w-max break-keep text-center text-2xs text-fg md:line-clamp-1 md:text-lg md:leading-[1.2] xl:text-xl xl:leading-[1.2] ${
            first ? 'left-0 min-w-full max-w-[54px] md:max-w-[100px] xl:max-w-[112px]' : 'left-1/2 max-w-[60px] -translate-x-1/2 md:max-w-[110px] xl:max-w-[165px]'
          }`}
        >
          {program.title}
        </p>
      </li>
    </>
  );
}

function InfoRow({ label, value, note, icon }: { label: string; value: string; note?: string; icon: string }) {
  return (
    <div className="flex w-full items-center gap-[10px]">
      <dt className="sr-only">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-baseline gap-[4px]">
        <span className="truncate text-md font-medium leading-[1.26] text-fg">{value}</span>
        {note ? <span className="shrink-0 text-2xs leading-[1.2] text-fg-tertiary">{note}</span> : null}
      </dd>
      <img alt="" src={`/assets/client/event-detail/${icon}.svg`} className="size-[16px] shrink-0" />
    </div>
  );
}
