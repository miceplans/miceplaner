'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AgentFab } from '@miceplans/ui';
import { AiChatPanel } from './ai-chat/ai-chat-panel';
import { isPublicPath } from './auth-guard';

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
