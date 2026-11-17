import { AppShell } from '@miceplans/ui/sidebar';
import { EventDetailView } from './event-detail-view';

const EVENT_IDS = ['e1', 'e2', 'e3', 'e4', 'e5'];

export const dynamicParams = false;

export function generateStaticParams() {
  return EVENT_IDS.map((id) => ({ id }));
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell active="events">
      <EventDetailView eventId={id} />
    </AppShell>
  );
}
