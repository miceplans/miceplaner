import type { ReactNode } from 'react';

/** 기본 버튼. Figma 표준: h32·px 14·gap 6·rounded-sm, 라벨 Pretendard 13/500. */
export function Button({
  variant = 'primary',
  type = 'button',
  href,
  onClick,
  disabled = false,
  className = '',
  children,
}: {
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit';
  /** 지정하면 <a>로 렌더링한다. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const cls = `flex h-[32px] shrink-0 items-center justify-center gap-[6px] rounded-sm px-[14px] text-base font-medium ${
    variant === 'primary'
      ? 'bg-brand text-fg-inverse'
      : 'border border-solid border-border bg-surface text-fg-secondary'
  } ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${className}`;
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
