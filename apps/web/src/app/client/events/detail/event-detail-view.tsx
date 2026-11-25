'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClientHeader } from '@miceplans/ui';
import { formatPeriodLong, inclusiveDays, programState, sortPrograms, todayIso } from '../../portal';
import { ScheduleStatus } from '../../schedule-status';
import { usePortalData } from '../../use-portal-data';

const A = '/assets/client/event-detail';

const MESSAGE = 'flex h-[120px] w-full items-center justify-center text-sm';

/** 지정된 행사의 기본 정보와 공개 Program 일정 (Figma 157:4535, 명세 F-07). */
export function ClientEventDetailView() {
  const id = useSearchParams().get('id') ?? '';
  const { events, programs, error } = usePortalData();
  const today = todayIso();

  const event = events?.find((e) => e.eventId === id) ?? null;
  const schedule = programs && event ? sortPrograms(programs.filter((p) => p.eventId === event.eventId)) : [];
  const days = event ? inclusiveDays(event.startDate, event.endDate) : 0;

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px flex-1 flex-col items-center px-[16px]">
        <div className="flex w-full max-w-[640px] shrink-0 flex-col items-start py-[40px] max-md:py-[20px]">
          <section className="flex min-h-[444px] w-full flex-col items-start rounded-card border border-solid border-border bg-surface p-[28px] max-md:p-[20px]">
            {error ? (
              <p role="alert" className={`${MESSAGE} text-error-delay`}>{error}</p>
            ) : events === null || programs === null ? (
              <p className={`${MESSAGE} text-fg-tertiary`}>불러오는 중…</p>
            ) : !event ? (
              <p className={`${MESSAGE} text-fg-tertiary`}>행사를 찾을 수 없습니다</p>
            ) : (
              <>
                <h1 className="w-full break-words text-2xl font-bold text-fg">{event.name}</h1>
                <dl className="flex w-full flex-col items-start">
                  <InfoRow icon="info" label="기간">
                    <InfoValue primary={formatPeriodLong(event.startDate, event.endDate)} secondary={`${days}일간 진행`} />
                  </InfoRow>
                  <InfoRow icon="info1" label="장소">
                    <InfoValue primary={event.place || '장소 미정'} />
                  </InfoRow>
                  <InfoRow icon="info" label="프로그램" top>
                    {schedule.length === 0 ? (
                      <InfoValue primary="공유된 프로그램 일정이 없습니다" />
                    ) : (
                      <ul className="flex w-full flex-col">
                        {schedule.map((p) => {
                          const start = p.startsOn ?? p.dueOn;
                          const state = programState(p.startsOn, p.dueOn, today);
                          return (
                            <li key={p.programId} className="flex min-h-[56px] w-full items-center justify-between gap-[12px]">
                              <InfoValue primary={p.title} secondary={start ? formatPeriodLong(start, p.dueOn ?? start) : '일정 미정'} />
                              {state ? <ScheduleStatus state={state} /> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </InfoRow>
                </dl>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/** 정보 행. top이면 값이 여러 줄일 때 라벨을 첫 줄(56px)에 맞춘다. */
function InfoRow({ icon, label, top = false, children }: { icon: string; label: string; top?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-h-[56px] w-full gap-[14px] ${top ? 'items-start' : 'items-center'}`}>
      <dt className={`flex shrink-0 items-center gap-[8px] ${top ? 'h-[56px]' : ''}`}>
        <img alt="" src={`${A}/${icon}.svg`} className="size-[16px] shrink-0" />
        <span className="w-[64px] text-base text-fg-secondary max-md:w-[52px]">{label}</span>
      </dt>
      <dd className={`flex min-w-0 flex-1 flex-col ${top ? 'min-h-[56px] justify-center' : ''}`}>{children}</dd>
    </div>
  );
}

function InfoValue({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-px">
      <p className="break-words text-md leading-[1.26] text-fg">{primary}</p>
      {secondary ? <p className="text-xs leading-[1.2] text-fg-secondary">{secondary}</p> : null}
    </div>
  );
}
