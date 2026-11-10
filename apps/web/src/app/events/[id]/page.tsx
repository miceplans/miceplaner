import { AppShell } from '@miceplans/ui/sidebar';
import { EventDetailView } from './event-detail-view';

// output: export는 동적 경로에 최소 1개 값이 필요하다. 실제 행사 ID는 서버 UUID라 프리렌더 불가능하다.
const EVENT_IDS = ['_'];

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
