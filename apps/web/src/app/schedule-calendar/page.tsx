import { AppShell, SCHEDULE_TABS, Topbar, ViewTabs } from '@miceplans/ui';
import { ScheduleViewCalendar } from './schedule-view-calendar';

export default function ScheduleCalendarPage() {
  return (
    <AppShell active="calendar">
      <div className="relative flex min-h-[900px] flex-col leading-[normal]">
        <Topbar />
        <ViewTabs tabs={SCHEDULE_TABS} active={2} />
        <ScheduleViewCalendar />
      </div>
    </AppShell>
  );
}
