import type { ReactNode } from 'react';
import { ToastViewport } from '@miceplans/ui';
import { AgentChat } from './agent-chat';
import './globals.css';

export const metadata = {
  title: 'mice planner',
  icons: { icon: '/assets/miceplaner-favicon.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <AgentChat />
        <ToastViewport />
      </body>
    </html>
  );
}
