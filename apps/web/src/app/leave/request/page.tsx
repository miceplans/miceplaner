import { AppShell } from '@miceplans/ui/sidebar';
import { LeaveRequestView } from './leave-request-view';

export default function LeaveRequestPage() {
  return (
    <AppShell active="leave">
      <LeaveRequestView />
    </AppShell>
  );
}
