import { Suspense } from 'react';
import { ClientEventDetailView } from './event-detail-view';

/** 행사 상세. 정적 export에서는 행사 UUID별 경로를 만들 수 없어 `?id=`로 받는다. */
export default function ClientEventDetailPage() {
  return (
    <Suspense fallback={<p className="p-[24px] text-base text-fg-secondary">불러오는 중…</p>}>
      <ClientEventDetailView />
    </Suspense>
  );
}
