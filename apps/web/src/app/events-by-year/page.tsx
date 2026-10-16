import { AppShell } from '@miceplans/ui';
import { EventsByYearView } from './events-by-year-view';

export default function EventsByYearPage() {
  return (
    <AppShell active="years">
      <EventsByYearView />
    </AppShell>
  );
}
