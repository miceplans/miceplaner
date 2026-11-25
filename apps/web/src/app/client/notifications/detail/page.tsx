import { Suspense } from 'react';
import { ClientNotificationDetailView } from './notification-detail-view';

/** 알림 상세. 정적 export라 알림별 경로를 만들 수 없어 `?id=`로 받는다. */
export default function ClientNotificationDetailPage() {
  return (
    <Suspense fallback={<p className="p-[24px] text-base text-fg-secondary">불러오는 중…</p>}>
      <ClientNotificationDetailView />
    </Suspense>
  );
}
