'use client';

import { useState } from 'react';
import { SCHEDULE_TABS, Topbar, ViewTabs } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { ScheduleViewCalendar } from './schedule-view-calendar';

export default function ScheduleCalendarPage() {
  const [tab, setTab] = useState(2);

  return (
    <AppShell active="calendar">
      <div className="relative flex min-h-[900px] flex-col leading-[normal]">
        <Topbar />
        <ViewTabs tabs={SCHEDULE_TABS} active={tab} onChange={setTab} />
        <ScheduleViewCalendar mine={tab === 1} />
      </div>
    </AppShell>
  );
}
