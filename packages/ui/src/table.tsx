import type { ReactNode } from 'react';

/**
 * 목록 표 구성 요소. Figma 표준: 테두리 rounded-lg 틀, 헤더 h36(bg-surface-sunken · 11/600 · tracking 0.4px · tertiary),
 * 행 min-h48 · px16 · 행 사이 border-b.
 */
export function TableFrame({ className = '', children }: { className?: string; children: ReactNode }): ReactNode {
  return <div className={`flex w-full flex-col items-start overflow-hidden rounded-lg border border-solid border-border bg-surface ${className}`}>{children}</div>;
}

export function TableHeader({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex h-[36px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface-sunken px-[16px] text-2xs font-semibold tracking-[0.4px] text-fg-tertiary">
      {children}
    </div>
  );
}

/** 표 행. href를 주면 행 전체가 링크다. 마지막 행의 하단 보더는 틀이 대신한다. */
export function TableRow({ href, className = '', children }: { href?: string; className?: string; children: ReactNode }): ReactNode {
  const cls = `flex min-h-[48px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border px-[16px] py-[8px] last:border-b-0 ${
    href ? 'hover:bg-surface-muted' : ''
  } ${className}`;
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/** 표의 빈 상태·불러오는 중·오류 안내 행. */
export function TableMessage({ tone = 'muted', children }: { tone?: 'muted' | 'error'; children: ReactNode }): ReactNode {
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`flex h-[48px] w-full items-center px-[16px] text-sm ${tone === 'error' ? 'text-error-delay' : 'text-fg-tertiary'}`}>
      {children}
    </div>
  );
}
