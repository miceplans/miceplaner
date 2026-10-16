import { AppShell } from '@miceplans/ui';
import { DashboardView } from './dashboard-view';

export default function DashboardPage() {
  return (
    <AppShell active="events">
      <DashboardView />
    </AppShell>
  );
}
