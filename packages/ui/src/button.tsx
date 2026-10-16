import type { ReactNode } from 'react';

/** 기본 버튼. Figma 표준: h32·px 14·gap 6·rounded-sm, 라벨 Pretendard 13/500. */
export function Button({
  variant = 'primary',
  type = 'button',
  onClick,
  children,
}: {
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex h-[32px] shrink-0 items-center justify-center gap-[6px] rounded-sm px-[14px] text-base font-medium ${
        variant === 'primary'
          ? 'bg-brand text-fg-inverse'
          : 'border border-solid border-border bg-surface text-fg-secondary'
      }`}
    >
      {children}
    </button>
  );
}
