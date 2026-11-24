'use client';

import { useSearchParams } from 'next/navigation';
import { ClientHeader } from '@miceplans/ui';
import { ddayLabel, eventState, formatRange, inclusiveDays, programState, sortPrograms, todayIso } from '../../portal';
import { usePortalData } from '../../use-portal-data';

const A = '/assets/client/event-detail';

const INFO_LABEL = 'h-[18px] w-[64px] shrink-0 text-base text-fg-secondary';

const STATE_TONE: Record<string, string> = {
  예정: 'bg-brand-tint text-brand',
  진행중: 'bg-brand text-fg-inverse',
  완료: 'bg-surface-chip text-fg-secondary',
};

/** 지정된 행사의 기본 정보와 공개 Program 일정 (명세 F-07). */
export function ClientEventDetailView() {
  const id = useSearchParams().get('id') ?? '';
  const { events, programs, error } = usePortalData();
  const today = todayIso();

  const event = events?.find((e) => e.eventId === id) ?? null;
  const schedule = programs && event ? sortPrograms(programs.filter((p) => p.eventId === event.eventId)) : null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px flex-1 flex-col items-center px-[16px]">
        <div className="flex w-full max-w-[640px] shrink-0 flex-col items-start py-[40px] max-md:py-[20px]">
          <a href="/client/events" className="flex h-[32px] shrink-0 items-center gap-[6px] px-[4px]">
            <img alt="" src={`${A}/back.svg`} className="size-[15px]" />
            <span className="whitespace-nowrap text-base text-fg-secondary">행사 일정</span>
          </a>
          {error ? (
            <p role="alert" className="flex h-[120px] w-full items-center justify-center text-sm text-error-delay">{error}</p>
          ) : events === null || programs === null ? (
            <p className="flex h-[120px] w-full items-center justify-center text-sm text-fg-tertiary">불러오는 중…</p>
          ) : !event ? (
            <p className="flex h-[120px] w-full items-center justify-center text-sm text-fg-tertiary">행사를 찾을 수 없습니다</p>
          ) : (
            <>
              <section className="flex w-full shrink-0 flex-col items-start rounded-xl border border-solid border-border bg-surface p-[28px] max-md:p-[20px]">
                <div className="flex h-[26px] shrink-0 items-center justify-center rounded-xl bg-ai-tint px-[11px]">
                  <p className="whitespace-nowrap text-sm font-medium text-ai">{eventState(event.startDate, event.endDate, today)}</p>
                </div>
                <h1 className="w-full break-words text-2xl font-bold leading-[1.3] text-fg">{event.name}</h1>
                <div className="h-px w-full shrink-0 bg-border-strong" />
                <ul className="flex w-full flex-col items-start">
                  <li className="flex min-h-[56px] w-full items-center gap-[14px] border-b border-solid border-border py-[10px]">
                    <img alt="" src={`${A}/info.svg`} className="size-[16px] shrink-0" />
                    <p className={INFO_LABEL}>일시</p>
                    <div className="flex shrink-0 flex-col items-start gap-px whitespace-nowrap leading-[normal]">
                      <p className="text-md text-fg">{formatRange(event.startDate, event.endDate)}</p>
                      <p className="text-xs text-fg-secondary">{inclusiveDays(event.startDate, event.endDate)}일간 · {ddayLabel(event.startDate, event.endDate, today)}</p>
                    </div>
                  </li>
                  <li className="flex min-h-[56px] w-full items-center gap-[14px] py-[10px]">
                    <img alt="" src={`${A}/info1.svg`} className="size-[16px] shrink-0" />
                    <p className={INFO_LABEL}>장소</p>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-px leading-[normal]">
                      <p className="break-words text-md text-fg">{event.place || '장소 미정'}</p>
                    </div>
                  </li>
                </ul>
              </section>

              <section className="mt-[24px] flex w-full shrink-0 flex-col items-start gap-[12px] rounded-xl border border-solid border-border bg-surface p-[28px] max-md:p-[20px]">
                <h2 className="whitespace-nowrap text-xl font-bold text-fg">프로그램 일정</h2>
                {schedule === null ? null : schedule.length === 0 ? (
                  <p className="text-sm text-fg-tertiary">공유된 프로그램 일정이 없습니다</p>
                ) : (
                  <ul className="flex w-full flex-col items-start">
                    {schedule.map((p) => {
                      const state = programState(p.startsOn, p.dueOn, today);
                      const when = p.startsOn && p.dueOn && p.startsOn !== p.dueOn ? formatRange(p.startsOn, p.dueOn) : p.startsOn ?? p.dueOn ?? '일정 미정';
                      return (
                        <li key={p.programId} className="flex min-h-[48px] w-full flex-wrap items-center gap-x-[14px] gap-y-[4px] border-b border-solid border-border py-[8px] last:border-b-0">
                          <p className="w-[170px] shrink-0 whitespace-nowrap max-md:w-full text-base text-fg-secondary">{when}</p>
                          <p className="min-w-px flex-1 text-md text-fg">{p.title}</p>
                          {state ? (
                            <span className={`flex h-[22px] shrink-0 items-center justify-center rounded-lg px-[9px] text-2xs font-semibold ${STATE_TONE[state]}`}>
                              {state}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
