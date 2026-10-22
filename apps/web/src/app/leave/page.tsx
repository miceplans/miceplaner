import { AppShell } from '@miceplans/ui/sidebar';
import { LeaveView } from './leave-view';

export default function LeavePage() {
  return (
    <AppShell active="leave">
      <LeaveView />
    </AppShell>
  );
}
