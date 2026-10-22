import { AppShell } from '@miceplans/ui/sidebar';
import { EventsByYearFolders } from './events-by-year-folders';

export default function EventsByYear2Page() {
  return (
    <AppShell active="years">
      <EventsByYearFolders />
    </AppShell>
  );
}
