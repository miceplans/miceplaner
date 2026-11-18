import { ClientEventDetailView } from './event-detail-view';

export const dynamicParams = false;

export function generateStaticParams() {
  // output: export는 동적 경로에 최소 1개 값이 필요하다. 실제 id는 클라이언트에서 조회한다.
  return [{ id: '_' }];
}

export default function ClientEventDetailPage() {
  return <ClientEventDetailView />;
}
