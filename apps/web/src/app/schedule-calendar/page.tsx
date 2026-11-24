'use client';

import { useState } from 'react';
import { SCHEDULE_TABS, Topbar, ViewTabs } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { ScheduleViewCalendar } from './schedule-view-calendar';

export default function ScheduleCalendarPage() {
  // SCHEDULE_TABS에서 '전체 일정' 탭이 빠져 '내 일정'=0, '캘린더'=1이다.
  const [tab, setTab] = useState(1);

  return (
    <AppShell active="calendar">
      <div className="relative flex min-h-[900px] flex-col leading-[normal]">
        <Topbar />
        <ViewTabs tabs={SCHEDULE_TABS} active={tab} onChange={setTab} />
        <ScheduleViewCalendar mine={tab === 0} />
      </div>
    </AppShell>
  );
}
