import type { ReactNode } from 'react';

/** AI Agent 로고(Figma AI Chat Panel의 Group 15). 패널 헤더와 동일하게 180° 회전해 사용한다. */
export function AgentLogo({ className = '' }: { className?: string }): ReactNode {
  return (
    <img
      alt=""
      src="/assets/shared/agent-logo.svg"
      className={`block h-[19.995px] w-[17.659px] rotate-180 ${className}`}
    />
  );
}

/**
 * 우하단 AI 채팅 FAB. 배경 없이 로고만 둔다.
 * 위치는 `className`으로 지정한다(부모는 relative).
 */
export function AgentFab({ className = '', label = 'AI 채팅 열기' }: { className?: string; label?: string }): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex size-[48px] items-center justify-center rounded-full shadow-ai ${className}`}
    >
      <AgentLogo />
    </button>
  );
}
