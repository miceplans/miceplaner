'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AgentFab } from '@miceplans/ui';
import { isPublicPath } from './auth-guard';

// 패널은 FAB을 눌러 열 때만 받는다. 루트 레이아웃에 정적으로 묶여 모든 페이지 번들에 들어가지 않게 한다.
const AiChatPanel = dynamic(() => import('./ai-chat/ai-chat-panel').then((module) => module.AiChatPanel), { ssr: false });

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (isPublicPath(pathname)) return null;

  return open ? (
    <AiChatPanel
      onClose={() => setOpen(false)}
      className="fixed bottom-[24px] right-[24px] z-50 flex h-[min(524px,calc(100dvh-48px))] w-[min(323px,calc(100vw-48px))] flex-col items-start overflow-hidden rounded-md border border-border bg-surface leading-[normal] shadow-panel"
    />
  ) : (
    <AgentFab className="fixed bottom-[24px] right-[24px] z-50" onClick={() => setOpen(true)} expanded={false} />
  );
}
