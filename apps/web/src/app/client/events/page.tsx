'use client';

import { useMemo } from 'react';
import { ClientHeader } from '@miceplans/ui';
import { ddayLabel, formatDay, formatMonth, formatPeriod, todayIso } from '../portal';
import { eventDetailHref, usePortalData } from '../use-portal-data';

/** 내 지정 행사 목록 (Figma 157:4468). 시작일 오름차순 (명세 F-07). */
export default function ClientEventsPage() {
  const { events: rows, error } = usePortalData();
  const events = useMemo(() => (rows ? [...rows].sort((a, b) => a.startDate.localeCompare(b.startDate)) : null), [rows]);
  const today = todayIso();

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px flex-1 flex-col items-center px-[32px] max-md:px-[16px]">
        <div className="flex w-full max-w-[1376px] shrink-0 flex-col items-start py-[48px] max-md:py-[24px]">
          <div className="flex w-full flex-col items-start gap-[8px] px-[4px] pb-[20px]">
            <h1 className="text-2xl font-bold leading-[1.2] text-fg">행사 일정</h1>
            <p className="text-md leading-[1.2] text-fg-secondary">공유된 행사만 표시됩니다</p>
          </div>
          <ul className="flex w-full flex-col items-start rounded-card border border-solid border-border bg-surface py-[6px]">
            {error ? (
              <li role="alert" className="flex h-[72px] w-full items-center justify-center text-sm text-error-delay">{error}</li>
            ) : events === null ? (
              <li className="flex h-[72px] w-full items-center justify-center text-sm text-fg-tertiary">불러오는 중…</li>
            ) : events.length === 0 ? (
              <li className="flex h-[72px] w-full items-center justify-center text-sm text-fg-tertiary">지정된 행사가 없습니다</li>
            ) : (
              events.map((e) => (
                <li key={e.eventId} className="w-full border-b border-solid border-border last:border-b-0">
                  <a href={eventDetailHref(e.eventId)} className="flex min-h-[71px] w-full items-center gap-[16px] px-[20px] py-[12px] hover:bg-surface-subtle max-md:px-[16px]">
                    <div className="flex w-[48px] shrink-0 flex-col items-center whitespace-nowrap">
                      <p className="text-[18px] font-bold leading-[1.1] text-fg">{formatDay(e.startDate)}</p>
                      <p className="text-2xs leading-[1.2] text-fg-secondary">{formatMonth(e.startDate)}</p>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
                      <p className="w-full break-words text-title font-medium text-fg">{e.name}</p>
                      <p className="w-full break-words text-base leading-[1.2] text-fg-secondary">
                        {formatPeriod(e.startDate, e.endDate)} · {e.place || '장소 미정'}
                      </p>
                    </div>
                    <span className="flex h-[24px] shrink-0 items-center justify-center rounded-full bg-surface-pill px-[9px] text-xs font-medium text-fg-pill">
                      {ddayLabel(e.startDate, e.endDate, today)}
                    </span>
                    <img alt="" src="/assets/client/calendar/row-chevron.svg" className="size-[16px] shrink-0" />
                  </a>
                </li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
