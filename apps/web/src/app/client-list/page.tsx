import { AppShell } from '@miceplans/ui/sidebar';
import { ClientListView } from './client-list-view';

export default function ClientListPage() {
  return (
    <AppShell active="clients">
      <ClientListView />
    </AppShell>
  );
}
