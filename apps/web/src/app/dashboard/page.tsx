import { AppShell } from '@miceplans/ui/sidebar';
import { DashboardView } from './dashboard-view';

export default function DashboardPage() {
  return (
    <AppShell active="events">
      <DashboardView />
    </AppShell>
  );
}
