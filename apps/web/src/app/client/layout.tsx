import type { ReactNode } from 'react';
import { ClientGate } from './client-gate';

// 내부 화면은 루트 레이아웃에서 색인을 막고, Client 포털만 검색 엔진 색인을 허용한다.
export const metadata = {
  robots: { index: true, follow: true },
};

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <ClientGate>{children}</ClientGate>;
}
