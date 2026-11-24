'use client';

import { useMemo, type ReactNode } from 'react';
import { ClientShell, DdayChip, PortalStateTag, SectionHeader, TableFrame, TableMessage, TableRow } from '@miceplans/ui';
import type { PortalProgramDto } from '@miceplans/contracts/portal';
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
} from '../portal';
import { eventDetailHref, usePortalData } from '../use-portal-data';

const STEP_LIMIT = 6;

/** Client 대시보드. 명세 F-07 범위(행사·Program 일정) 데이터로만 구성한다. */
export default function ClientDashboardPage() {
  const { events, programs, error } = usePortalData();
  const today = todayIso();

  const eventName = useMemo(() => new Map((events ?? []).map((e) => [e.eventId, e.name])), [events]);

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

  const upcomingTag = (p: PortalProgramDto): ReactNode => {
    const start = p.startsOn ?? p.dueOn;
    if (!start) return null;
    const state = programState(p.startsOn, p.dueOn, today);
    if (state === '완료' || state === '진행중') return <PortalStateTag state={state} />;
    return <DdayChip>D-{daysUntil(start, today)}</DdayChip>;
  };

  const donePrograms = focusPrograms.filter((p) => programState(p.startsOn, p.dueOn, today) === '완료').length;
  const percent = focusPrograms.length > 0 ? Math.round((donePrograms / focusPrograms.length) * 100) : 0;
  const steps = focusPrograms.slice(0, STEP_LIMIT);
  const hiddenPrograms = focusPrograms.length - steps.length;
  const placeholder = loading ? '불러오는 중…' : null;

  return (
    <ClientShell active="dashboard" title="대시보드">
      {error ? <TableFrame><TableMessage tone="error">{error}</TableMessage></TableFrame> : null}

      <section className="flex w-full flex-col gap-[10px]">
        <SectionHeader title="진행 중인 행사" link={{ label: '전체 행사', href: '/client/events' }} />
        <TableFrame className="gap-[14px] p-[20px]">
          {focus ? (
            <>
              <div className="flex w-full flex-wrap items-center gap-[8px]">
                <PortalStateTag state={eventState(focus.startDate, focus.endDate, today)} />
                {eventState(focus.startDate, focus.endDate, today) === '예정' ? <DdayChip>{ddayLabel(focus.startDate, focus.endDate, today)}</DdayChip> : null}
              </div>
              <a href={eventDetailHref(focus.eventId)} className="w-full break-words text-xl font-bold tracking-[-0.008em] text-fg hover:underline">
                {focus.name}
              </a>
              <dl className="flex w-full flex-wrap gap-x-[24px] gap-y-[6px] text-base">
                <div className="flex gap-[8px]">
                  <dt className="text-fg-tertiary">기간</dt>
                  <dd className="text-fg">{formatRange(focus.startDate, focus.endDate)}</dd>
                </div>
                <div className="flex min-w-0 gap-[8px]">
                  <dt className="shrink-0 text-fg-tertiary">장소</dt>
                  <dd className="min-w-0 break-words text-fg">{focus.place || '장소 미정'}</dd>
                </div>
              </dl>
              <div className="flex w-full items-center gap-[12px]">
                <div className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-chip">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-fg-secondary">
                  프로그램 {donePrograms}/{focusPrograms.length} 완료 · {percent}%
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-fg-tertiary">{placeholder ?? '지정된 행사가 없습니다'}</p>
          )}
        </TableFrame>
      </section>

      <div className="grid w-full grid-cols-1 gap-[16px] lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-[10px]">
          <SectionHeader title="프로그램 진행" link={focus ? { label: '행사 상세', href: eventDetailHref(focus.eventId) } : undefined} />
          <TableFrame>
            {placeholder ? (
              <TableMessage>{placeholder}</TableMessage>
            ) : steps.length === 0 ? (
              <TableMessage>공유된 프로그램 일정이 없습니다</TableMessage>
            ) : (
              <>
                {steps.map((p, i) => {
                  const when = p.startsOn ?? p.dueOn;
                  return (
                    <TableRow key={p.programId}>
                      <span className="w-[16px] shrink-0 text-2xs font-semibold text-fg-tertiary">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-base text-fg">{p.title}</span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-fg-tertiary max-sm:hidden">{when ? formatDate(when) : '일정 미정'}</span>
                      <PortalStateTag state={programState(p.startsOn, p.dueOn, today) ?? '예정'} />
                    </TableRow>
                  );
                })}
                {hiddenPrograms > 0 && focus ? (
                  <TableRow href={eventDetailHref(focus.eventId)}>
                    <span className="text-xs font-medium text-fg-secondary">+ {hiddenPrograms}개 더 보기</span>
                  </TableRow>
                ) : null}
              </>
            )}
          </TableFrame>
        </section>

        <section className="flex min-w-0 flex-col gap-[10px]">
          <SectionHeader title="다가오는 일정" link={{ label: '캘린더 보기', href: '/client/calendar' }} />
          <TableFrame>
            {placeholder ? (
              <TableMessage>{placeholder}</TableMessage>
            ) : upcoming.length === 0 ? (
              <TableMessage>다가오는 일정이 없습니다</TableMessage>
            ) : (
              upcoming.map((p) => {
                const when = p.startsOn ?? p.dueOn;
                return (
                  <TableRow key={p.programId}>
                    <span className="w-[40px] shrink-0 whitespace-nowrap text-base font-semibold text-fg">{when ? formatDate(when).slice(5) : '미정'}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <span className="truncate text-base text-fg">{p.title}</span>
                      <span className="truncate text-2xs text-fg-tertiary">{eventName.get(p.eventId) ?? ''}</span>
                    </div>
                    {upcomingTag(p)}
                  </TableRow>
                );
              })
            )}
          </TableFrame>
        </section>
      </div>
    </ClientShell>
  );
}
