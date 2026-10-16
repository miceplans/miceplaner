import type { ReactNode } from 'react';

const A = '/assets/flow';

/** 상단바. 좌측(leading/breadcrumb)만 페이지마다 다르다. */
export function FlowTopbar({
  title,
  leading,
  breadcrumb,
  showToggle = false,
  showKbd = true,
}: {
  /** 단일 제목(예: Tasks). breadcrumb와 함께 쓰지 않는다. */
  title?: string;
  /** [상위, 현재] 경로. */
  breadcrumb?: [string, string];
  /** title 대신 좌측에 넣을 임의 요소(예: 행사 선택 드롭다운). */
  leading?: ReactNode;
  showToggle?: boolean;
  showKbd?: boolean;
}): ReactNode {
  return (
    <div className="flex h-[56px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
      {showToggle ? (
        <button type="button" aria-label="사이드바 토글" className="flex size-[28px] shrink-0 items-center justify-center rounded-sm">
          <img alt="" src={`${A}/toggle-icon.svg`} className="size-[16px]" />
        </button>
      ) : null}
      <div className="flex h-full items-center gap-[6px]">
        {leading}
        {title ? <p className="whitespace-nowrap text-base font-semibold text-fg">{title}</p> : null}
        {breadcrumb ? (
          <>
            <p className="whitespace-nowrap text-base text-fg-secondary">{breadcrumb[0]}</p>
            <img alt="" src={`${A}/crumb-chevron.svg`} className="size-[13px]" />
            <p className="whitespace-nowrap text-base font-semibold text-fg">{breadcrumb[1]}</p>
          </>
        ) : null}
      </div>
      <div className="h-px min-w-px flex-1" />
      <div className="flex h-[32px] w-[280px] shrink-0 items-center gap-[8px] rounded-sm bg-surface-chip px-[10px]">
        <img alt="" src={`${A}/search-icon.svg`} className="size-[15px]" />
        <p className="whitespace-nowrap text-base text-fg-tertiary">Search</p>
        <div className="h-px min-w-px flex-1" />
        {showKbd ? (
          <div className="flex h-[20px] items-center justify-center rounded-xs bg-surface px-[5px] text-2xs text-fg-secondary">⌘K</div>
        ) : null}
      </div>
      <button type="button" className="flex h-[30px] shrink-0 items-center gap-[6px] rounded-sm bg-brand px-[12px]">
        <img alt="" src={`${A}/plus-icon.svg`} className="size-[14px]" />
        <span className="whitespace-nowrap text-base font-semibold text-fg-inverse">New 행사</span>
      </button>
      <div className="flex size-[26px] shrink-0 items-center justify-center rounded-xl bg-brand-tint text-2xs font-semibold text-brand">
        JY
      </div>
    </div>
  );
}

/** AppShell 안쪽 콘텐츠 영역(1200px): 상단바 + 본문(Main). */
export function PageFrame({
  topbar,
  fab,
  mainClassName = '',
  children,
}: {
  topbar: ReactNode;
  /** 페이지 전용 우하단 플로팅 요소. AI FAB은 루트 레이아웃에서 전역으로 렌더링한다. */
  fab?: ReactNode;
  mainClassName?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-[900px] flex-col leading-[normal]">
      {topbar}
      <div className={`relative flex flex-1 flex-col bg-surface ${mainClassName}`}>
        {children}
        {fab}
      </div>
    </div>
  );
}

export function FlowButton({
  variant = 'ghost',
  href,
  children,
}: {
  variant?: 'ghost' | 'primary';
  href?: string;
  children: ReactNode;
}): ReactNode {
  const cls = `flex h-[32px] shrink-0 cursor-pointer items-center justify-center rounded-sm px-[14px] text-base font-medium whitespace-nowrap ${
    variant === 'primary' ? 'bg-brand text-fg-inverse' : 'border border-solid border-border bg-surface text-fg-secondary'
  }`;
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" className={cls}>
      {children}
    </button>
  );
}

export const FLOW_CARD_SHADOW = 'shadow-card';
