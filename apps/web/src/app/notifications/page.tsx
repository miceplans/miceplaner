import { AppShell } from '@miceplans/ui/sidebar';
import { NotificationsView } from './notifications-view';

export default function NotificationsPage() {
  return (
    <AppShell active="notifications">
      <NotificationsView />
    </AppShell>
  );
}
