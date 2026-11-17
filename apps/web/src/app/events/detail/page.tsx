'use client';

import { AppShell } from '@miceplans/ui/sidebar';
import { EventDetailView } from './event-detail-view';

/**
 * 행사 상세. 정적 export(ADR 0001)라 경로 파라미터 대신 쿼리로 받는다: /events/detail?id=<uuid>.
 * 실제 데이터가 없는 목업 id도 기존처럼 볼 수 있다.
 */
export default function EventDetailPage() {
  return (
    <AppShell active="events">
      <EventDetailView />
    </AppShell>
  );
}
