import { MARCH_2025, MonthCalendar, SCHEDULE_TABS, Topbar, ViewTabs } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { SidePeekPanel } from './side-peek-panel';

export default function ScheduleCalendar2Page() {
  return (
    <AppShell active="calendar">
      <div className="relative flex min-h-[900px] flex-col leading-[normal] overflow-hidden">
        <Topbar />
        <ViewTabs tabs={SCHEDULE_TABS} active={2} />
        <MonthCalendar title="2025년 3월" weeks={MARCH_2025} />
        <SidePeekPanel />
      </div>
    </AppShell>
  );
}
