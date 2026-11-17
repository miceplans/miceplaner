import { AppShell } from '@miceplans/ui/sidebar';
import { NewEventForm } from './new-event-form';

export default function NewEventPage() {
  return (
    <AppShell active="events">
      <NewEventForm />
    </AppShell>
  );
}
