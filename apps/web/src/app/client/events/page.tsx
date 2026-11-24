'use client';

import { useMemo } from 'react';
import { ClientShell, DdayChip, PortalStateTag, TableFrame, TableHeader, TableMessage, TableRow } from '@miceplans/ui';
import { ddayLabel, eventState, formatRange, todayIso } from '../portal';
import { eventDetailHref, usePortalData } from '../use-portal-data';

/** 내 지정 행사 목록. 시작일 오름차순 (명세 F-07). */
export default function ClientEventsPage() {
  const { events: rows, error } = usePortalData();
  const events = useMemo(() => (rows ? [...rows].sort((a, b) => a.startDate.localeCompare(b.startDate)) : null), [rows]);
  const today = todayIso();

  return (
    <ClientShell active="events" title="행사">
      <p className="text-sm text-fg-secondary">공유된 행사만 표시됩니다.</p>
      <TableFrame>
        <TableHeader>
          <span className="min-w-0 flex-1">행사명</span>
          <span className="w-[180px] shrink-0 max-md:hidden">기간</span>
          <span className="w-[200px] shrink-0 max-lg:hidden">장소</span>
          <span className="w-[140px] shrink-0 max-sm:w-auto">상태</span>
        </TableHeader>
        {error ? (
          <TableMessage tone="error">{error}</TableMessage>
        ) : events === null ? (
          <TableMessage>불러오는 중…</TableMessage>
        ) : events.length === 0 ? (
          <TableMessage>지정된 행사가 없습니다</TableMessage>
        ) : (
          events.map((e) => (
            <TableRow key={e.eventId} href={eventDetailHref(e.eventId)}>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="truncate text-base font-semibold text-fg">{e.name}</span>
                <span className="truncate text-2xs text-fg-tertiary md:hidden">{formatRange(e.startDate, e.endDate)}</span>
              </div>
              <span className="w-[180px] shrink-0 whitespace-nowrap text-sm text-fg-secondary max-md:hidden">{formatRange(e.startDate, e.endDate)}</span>
              <span className="w-[200px] shrink-0 truncate text-sm text-fg-secondary max-lg:hidden">{e.place || '장소 미정'}</span>
              <div className="flex w-[140px] shrink-0 items-center gap-[6px] max-sm:w-auto">
                <PortalStateTag state={eventState(e.startDate, e.endDate, today)} />
                {eventState(e.startDate, e.endDate, today) === '예정' ? <DdayChip>{ddayLabel(e.startDate, e.endDate, today)}</DdayChip> : null}
              </div>
            </TableRow>
          ))
        )}
      </TableFrame>
    </ClientShell>
  );
}
