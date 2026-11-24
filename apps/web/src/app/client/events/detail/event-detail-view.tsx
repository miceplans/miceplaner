'use client';

import { useSearchParams } from 'next/navigation';
import { ClientShell, DdayChip, PortalStateTag, SectionHeader, TableFrame, TableHeader, TableMessage, TableRow } from '@miceplans/ui';
import { ddayLabel, eventState, formatRange, inclusiveDays, programState, sortPrograms, todayIso } from '../../portal';
import { usePortalData } from '../../use-portal-data';

const A = '/assets/client/event-detail';

/** 지정된 행사의 기본 정보와 공개 Program 일정 (명세 F-07). */
export function ClientEventDetailView() {
  const id = useSearchParams().get('id') ?? '';
  const { events, programs, error } = usePortalData();
  const today = todayIso();

  const event = events?.find((e) => e.eventId === id) ?? null;
  const schedule = programs && event ? sortPrograms(programs.filter((p) => p.eventId === event.eventId)) : null;

  const title = (
    <div className="flex min-w-0 items-center gap-[6px] text-base">
      <a href="/client/events" className="whitespace-nowrap text-fg-secondary hover:text-fg">행사</a>
      <img alt="" src="/assets/flow/crumb-chevron.svg" className="size-[13px] shrink-0" />
      <span className="truncate font-semibold text-fg">{event?.name ?? '행사 상세'}</span>
    </div>
  );

  return (
    <ClientShell active="events" title={title}>
      {error ? (
        <TableFrame><TableMessage tone="error">{error}</TableMessage></TableFrame>
      ) : events === null || programs === null ? (
        <TableFrame><TableMessage>불러오는 중…</TableMessage></TableFrame>
      ) : !event ? (
        <TableFrame><TableMessage>행사를 찾을 수 없습니다</TableMessage></TableFrame>
      ) : (
        <>
          <div className="flex w-full flex-col gap-[10px]">
            <div className="flex flex-wrap items-center gap-[8px]">
              <PortalStateTag state={eventState(event.startDate, event.endDate, today)} />
              {eventState(event.startDate, event.endDate, today) === '예정' ? <DdayChip>{ddayLabel(event.startDate, event.endDate, today)}</DdayChip> : null}
            </div>
            <h1 className="w-full break-words text-xl font-bold tracking-[-0.008em] text-fg">{event.name}</h1>
          </div>

          <TableFrame>
            <TableRow>
              <img alt="" src={`${A}/info.svg`} className="size-[16px] shrink-0" />
              <span className="w-[56px] shrink-0 text-sm text-fg-secondary">일시</span>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="text-base text-fg">{formatRange(event.startDate, event.endDate)}</span>
                <span className="text-xs text-fg-tertiary">{inclusiveDays(event.startDate, event.endDate)}일간</span>
              </div>
            </TableRow>
            <TableRow>
              <img alt="" src={`${A}/info1.svg`} className="size-[16px] shrink-0" />
              <span className="w-[56px] shrink-0 text-sm text-fg-secondary">장소</span>
              <span className="min-w-0 flex-1 break-words text-base text-fg">{event.place || '장소 미정'}</span>
            </TableRow>
          </TableFrame>

          <section className="flex w-full flex-col gap-[10px]">
            <SectionHeader title="프로그램 일정" />
            <TableFrame>
              <TableHeader>
                <span className="w-[170px] shrink-0 max-md:hidden">일정</span>
                <span className="min-w-0 flex-1">프로그램</span>
                <span className="shrink-0">상태</span>
              </TableHeader>
              {schedule === null || schedule.length === 0 ? (
                <TableMessage>공유된 프로그램 일정이 없습니다</TableMessage>
              ) : (
                schedule.map((p) => {
                  const state = programState(p.startsOn, p.dueOn, today);
                  const when = p.startsOn && p.dueOn && p.startsOn !== p.dueOn ? formatRange(p.startsOn, p.dueOn) : p.startsOn ?? p.dueOn ?? '일정 미정';
                  return (
                    <TableRow key={p.programId}>
                      <span className="w-[170px] shrink-0 whitespace-nowrap text-sm text-fg-secondary max-md:hidden">{when}</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                        <span className="break-words text-base text-fg">{p.title}</span>
                        <span className="text-2xs text-fg-tertiary md:hidden">{when}</span>
                      </div>
                      {state ? <PortalStateTag state={state} /> : null}
                    </TableRow>
                  );
                })
              )}
            </TableFrame>
          </section>
        </>
      )}
    </ClientShell>
  );
}
