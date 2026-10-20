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
 * 우하단 AI 채팅 FAB. 배경 없이 로고만 두고, 로고에 검은 그림자를 입힌다(drop-shadow).
 * 위치는 `className`으로 지정한다(전역 플로팅은 루트 레이아웃에서 지정).
 */
export function AgentFab({ className = '', label = 'AI 채팅 열기', onClick, expanded }: { className?: string; label?: string; onClick?: () => void; expanded?: boolean }): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      className={`flex size-[64px] items-center justify-center rounded-full bg-transparent drop-shadow-ai ${className}`}
    >
      <AgentLogo className="scale-[1.35]" />
    </button>
  );
}
