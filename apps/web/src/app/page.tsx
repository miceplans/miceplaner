'use client';

import { useMemo, useState } from 'react';
import { EventTable, type EventRow } from './event-table';
import { NoticeList } from './notice-list';
import { ViewTabs, type ViewTab } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { ScheduleViewCalendar } from './schedule-calendar/schedule-view-calendar';
import { getToken } from '../lib/api';
import { useEventsList, useGetMe } from '../lib/api/generated/endpoints';
import type { EventListItemDto } from '@miceplans/contracts';

const TABS: ViewTab[] = [
  { label: '전체 행사', icon: '10b86', activeIcon: '753c4', href: '/' },
  { label: '공지', icon: '/assets/sidebar/notifications.svg' },
  { label: '내 행사', icon: '10b86' },
];

/** API 행사를 표 행으로 바꾼다. 아직 데이터 모델에 없는 값(디자인 담당)은 비워 둔다. */
function toRow(event: EventListItemDto): EventRow {
  return {
    id: event.id,
    name: event.name,
    color: event.color,
    startDate: event.startDate,
    endDate: event.endDate,
    priority: event.priority,
    client: event.clientName ?? '',
    pm: event.pmName ?? '',
    am: event.amName ?? '',
    design: '',
    status: event.status,
    place: event.place,
  };
}

export default function HomePage() {
  const [tab, setTab] = useState(0);
  const events = useEventsList();
  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const rows = useMemo(() => (events.data ?? []).map(toRow), [events.data]);
  // PM·AM 이름은 다중이면 ', '로 묶여 오므로 포함 여부로 본다. 로그인 정보가 없으면 비워 둔다.
  const meName = me.data?.name ?? null;
  const shown = useMemo(
    () =>
      tab === 2
        ? meName
          ? rows.filter((row) => [row.pm, row.am].some((names) => names.split(',').map((s) => s.trim()).includes(meName)))
          : []
        : rows,
    [tab, meName, rows],
  );
  return (
    <AppShell active="events">
      <div className="flex min-h-screen flex-col leading-[normal]">
        <ViewTabs
          tabs={TABS}
          active={tab}
          onChange={setTab}
          bordered
          action={tab !== 1 ? <a href="/events/new" className="flex h-[32px] items-center gap-[6px] rounded-md bg-brand px-[12px] text-sm font-semibold text-fg-inverse no-underline hover:opacity-90"><span className="text-base font-normal leading-none">+</span> 행사 추가</a> : undefined}
        />
        {tab === 1 ? (
          <NoticeList />
        ) : (
          <div className="flex w-full flex-col gap-[24px]">
            <EventTable key={tab} initial={shown} />
            <ScheduleViewCalendar gridGap={19} padX={20} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
