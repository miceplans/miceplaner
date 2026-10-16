import { AppShell } from '@miceplans/ui';
import { NotificationsView } from './notifications-view';

export default function NotificationsPage() {
  return (
    <AppShell active="notifications">
      <NotificationsView />
    </AppShell>
  );
}
