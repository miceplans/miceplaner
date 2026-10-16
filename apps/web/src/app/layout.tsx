import type { ReactNode } from 'react';
import { AgentFab } from '@miceplans/ui';
import './globals.css';

export const metadata = {
  title: 'MICE PLANER',
  icons: { icon: '/assets/miceplaner-favicon.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        {/* AI 채팅 FAB: 모든 페이지 우하단에 상시 플로팅 */}
        <AgentFab className="fixed bottom-[24px] right-[24px] z-50" />
      </body>
    </html>
  );
}
