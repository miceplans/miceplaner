import { ClientEventDetail } from './client-event-detail';

export const dynamicParams = false;

export function generateStaticParams() {
  // output: export는 동적 경로에 최소 1개 값이 필요하다. 실제 행사 ID는 서버 UUID라 프리렌더할 수 없으므로
  // 자리표시 경로(`_`) 하나만 만들고, 웹 배포의 rewrite가 `/client/events/<id>`를 이 셸로 연결한다. ID는 URL에서 읽는다.
  return [{ id: '_' }];
}

export default function ClientEventDetailPage() {
  return <ClientEventDetail />;
}
