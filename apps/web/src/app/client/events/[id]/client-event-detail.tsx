'use client';

import { usePathname } from 'next/navigation';
import { usePortalEvents, usePortalPrograms } from '../../../../lib/api/generated/endpoints';
import { ddayLabel } from '../../portal-data';

const A = '/assets/client/event-detail';

export function ClientEventDetail() {
  // 정적 셸(`_`) 위에서 rewrite로 열리므로 경로의 마지막 조각이 실제 행사 ID다.
  const eventId = usePathname().replace(/\/$/, '').split('/').pop() ?? '';
  const events = usePortalEvents();
  const programs = usePortalPrograms();
  const event = events.data?.find((e) => e.eventId === eventId);
  const eventPrograms = (programs.data ?? []).filter((p) => p.eventId === eventId);
  const info = event
    ? [
        { label: '일정', icon: 'info', main: `${event.startDate} ~ ${event.endDate}`, sub: ddayLabel(event.startDate) },
        { label: '장소', icon: 'info1', main: event.place || '미정', sub: '' },
      ]
    : [];

  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <header className="flex h-[64px] w-full shrink-0 items-center gap-[10px] border-b border-solid border-border bg-surface px-[32px]">
        <div className="flex size-[26px] shrink-0 items-center justify-center rounded-sm bg-fg">
          <p className="text-base font-semibold text-fg-inverse">M</p>
        </div>
        <p className="whitespace-nowrap text-md font-semibold tracking-[0.3px] text-fg">MICEPLANNER</p>
        <div className="h-[16px] w-px shrink-0 bg-border-strong" />
        <p className="whitespace-nowrap text-sm text-fg-secondary">고객 포털</p>
      </header>
      <main className="flex min-h-px flex-1 flex-col items-center">
        <div className="flex w-[640px] shrink-0 flex-col items-start py-[40px]">
          <a href="/client/events" className="flex h-[32px] shrink-0 items-center gap-[6px] px-[4px]">
            <img alt="" src={`${A}/back.svg`} className="size-[15px]" />
            <span className="whitespace-nowrap text-base text-fg-secondary">행사 일정</span>
          </a>
          <section className="flex min-h-[444px] w-full shrink-0 flex-col items-start rounded-xl border border-solid border-border bg-surface p-[28px]">
            {events.isError ? <p className="text-base text-error-delay">[오류] 행사를 불러오지 못했습니다.</p> : null}
            {events.isSuccess && !event ? <p className="text-base text-fg-secondary">공유된 행사를 찾을 수 없습니다.</p> : null}
            {event ? (
              <>
                <h1 className="w-full text-2xl font-bold leading-[1.3] text-fg">{event.name}</h1>
                <div className="h-px w-full shrink-0 bg-border-strong" />
                <ul className="flex w-full flex-col items-start">
                  {info.map((r) => (
                    <li key={r.label} className="flex h-[56px] w-full items-center gap-[14px] border-b border-solid border-border">
                      <img alt="" src={`${A}/${r.icon}.svg`} className="size-[16px] shrink-0" />
                      <p className="h-[18px] w-[64px] shrink-0 text-base text-fg-secondary">{r.label}</p>
                      <div className="flex h-full shrink-0 flex-col items-start gap-px whitespace-nowrap leading-[normal]">
                        <p className="text-md text-fg">{r.main}</p>
                        {r.sub ? <p className="text-xs text-fg-secondary">{r.sub}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
                <h2 className="mt-[20px] text-lg font-semibold text-fg">공개 Program</h2>
                {programs.isError ? <p className="text-base text-error-delay">[오류] Program을 불러오지 못했습니다.</p> : null}
                {programs.isSuccess && eventPrograms.length === 0 ? <p className="text-base text-fg-secondary">공개된 Program이 없습니다.</p> : null}
                <ul className="flex w-full flex-col">
                  {eventPrograms.map((p) => (
                    <li key={p.programId} className="flex h-[48px] w-full items-center justify-between border-b border-solid border-border">
                      <p className="text-md text-fg">{p.title}</p>
                      <p className="text-sm text-fg-secondary">{[p.startsOn, p.dueOn].filter(Boolean).join(' ~ ') || '일정 미정'}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
