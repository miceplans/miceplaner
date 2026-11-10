'use client';

import { useState } from 'react';
import { EventTable } from './event-table';
import { NoticeList } from './notice-list';
import { ViewTabs, type StatusKey, type ViewTab } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { ScheduleViewCalendar } from './schedule-calendar/schedule-view-calendar';

const TABS: ViewTab[] = [
  { label: '전체 행사', icon: '10b86', activeIcon: '753c4', href: '/' },
  { label: '공지', icon: '/assets/sidebar/notifications.svg' },
  { label: '내 행사', icon: '10b86' },
];

const EVENTS: { id: string; name: string; dot: string; startDate: string; endDate: string; priority?: boolean; client: string; pm: string; am: string; design: string; status: StatusKey; place: string; budget?: string }[] = [];

export default function HomePage() {
  const [tab, setTab] = useState(0);
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
            <EventTable key={tab} initial={EVENTS} />
            <ScheduleViewCalendar gridGap={19} padX={20} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
