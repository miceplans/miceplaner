import { Suspense } from 'react';
import { AppShell } from '@miceplans/ui/sidebar';
import { EventsByYearView } from './events-by-year-view';

export default function EventsByYearPage() {
  return (
    <AppShell active="years">
      <Suspense>
        <EventsByYearView />
      </Suspense>
    </AppShell>
  );
}
