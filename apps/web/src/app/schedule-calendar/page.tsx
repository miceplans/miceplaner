import { AiFab, AppShell, MARCH_2025, MonthCalendar, SCHEDULE_TABS, Topbar, ViewTabs } from '@miceplans/ui';

export default function ScheduleCalendarPage() {
  return (
    <AppShell active="calendar">
      <div className="relative flex min-h-[900px] flex-col leading-[normal]">
        <Topbar />
        <ViewTabs tabs={SCHEDULE_TABS} active={2} />
        <MonthCalendar title="2025년 3월" weeks={MARCH_2025} />
        <AiFab />
      </div>
    </AppShell>
  );
}
