import { Suspense } from 'react';
import { AppShell } from '@miceplans/ui/sidebar';
import { LeaveRequestView } from './leave-request-view';

export default function LeaveRequestPage() {
  return (
    <AppShell active="leave">
      <Suspense>
        <LeaveRequestView />
      </Suspense>
    </AppShell>
  );
}
