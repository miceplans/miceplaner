'use client';

import { useMemo } from 'react';
import { ClientHeader } from '@miceplans/ui';
import { ddayLabel, formatDay, formatMonth, todayIso } from '../portal';
import { eventDetailHref, usePortalData } from '../use-portal-data';

const HOT = new Set(['D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1']);

/** 내 지정 행사 목록. 시작일 오름차순 (명세 F-07). */
export default function ClientEventsPage() {
  const { events: rows, error } = usePortalData();
  const events = useMemo(() => (rows ? [...rows].sort((a, b) => a.startDate.localeCompare(b.startDate)) : null), [rows]);
  const today = todayIso();

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px flex-1 flex-col items-center px-[32px] max-md:px-[16px]">
        <div className="flex w-full max-w-[1200px] shrink-0 flex-col items-start py-[48px] max-md:py-[24px]">
          <div className="flex w-full flex-col items-start gap-[8px] px-[4px] pb-[20px] leading-[normal]">
            <h1 className="text-2xl font-bold text-fg">행사 일정</h1>
            <p className="text-md text-fg-secondary">공유된 행사만 표시됩니다</p>
          </div>
          <ul className="flex w-full flex-col items-start rounded-xl border border-solid border-border bg-surface py-[6px]">
            {error ? (
              <li role="alert" className="flex h-[72px] w-full items-center justify-center text-sm text-error-delay">{error}</li>
            ) : events === null ? (
              <li className="flex h-[72px] w-full items-center justify-center text-sm text-fg-tertiary">불러오는 중…</li>
            ) : events.length === 0 ? (
              <li className="flex h-[72px] w-full items-center justify-center text-sm text-fg-tertiary">지정된 행사가 없습니다</li>
            ) : (
              events.map((e) => {
                const dday = ddayLabel(e.startDate, e.endDate, today);
                return (
                  <li key={e.eventId} className="w-full">
                    <a
                      href={eventDetailHref(e.eventId)}
                      className="flex min-h-[72px] w-full items-center gap-[16px] border-b border-solid border-border px-[20px] py-[12px]"
                    >
                      <div className="flex w-[48px] shrink-0 flex-col items-center whitespace-nowrap">
                        <p className="text-lg font-bold leading-[1.1] text-fg">{formatDay(e.startDate)}</p>
                        <p className="text-2xs text-fg-secondary">{formatMonth(e.startDate)}</p>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px] leading-[normal]">
                        <p className="w-full break-words text-lg font-medium text-fg">{e.name}</p>
                        <p className="w-full break-words text-base text-fg-secondary">{e.place || '장소 미정'}</p>
                      </div>
                      <span
                        className={`flex h-[24px] shrink-0 items-center justify-center rounded-xl px-[9px] text-xs font-medium ${
                          dday === '진행중' ? 'bg-brand text-fg-inverse' : HOT.has(dday) ? 'bg-brand-tint text-brand' : 'bg-surface-chip text-fg-secondary'
                        }`}
                      >
                        {dday}
                      </span>
                      <img alt="" src="/assets/client/calendar/row-chevron.svg" className="size-[16px] shrink-0" />
                    </a>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
