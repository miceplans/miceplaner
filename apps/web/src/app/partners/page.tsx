import { AppShell } from '@miceplans/ui/sidebar';
import { PartnersView } from './partners-view';

export default function PartnersPage() {
  return (
    <AppShell active="partners">
      <PartnersView />
    </AppShell>
  );
}
