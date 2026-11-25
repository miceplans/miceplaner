import type { ReactNode } from 'react';

const A = '/assets/client';

export type ClientNavKey = 'dashboard' | 'calendar' | 'notifications';

const NAV: { key: ClientNavKey; label: string; href: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', href: '/client/dashboard', icon: 'layout-dashboard' },
  { key: 'calendar', label: '캘린더', href: '/client/calendar', icon: 'calendar' },
  { key: 'notifications', label: '알림함', href: '/client/notifications', icon: 'inbox' },
];

/**
 * 단색 아이콘. SVG를 마스크로 써서 활성 여부·톤에 따라 현재 글자색을 입힌다.
 * 색은 `className`의 text-* 로, 크기는 size-* 로 지정한다.
 */
export function ClientIcon({ src, className = '' }: { src: string; className?: string }): ReactNode {
  const mask = `url(${src}) center / contain no-repeat`;
  return <span aria-hidden className={`block shrink-0 bg-current ${className}`} style={{ mask, WebkitMask: mask }} />;
}

/** 클라이언트 포털 공통 헤더(로고 + 가운데 탭 내비게이션). Figma 157:5814. action을 주면 탭 대신 그 요소(예: 로그인 버튼)를 오른쪽에 둔다. */
export function ClientHeader({ active = 'dashboard', action }: { active?: ClientNavKey; action?: ReactNode }): ReactNode {
  return (
    <header
      className={`w-full shrink-0 items-center gap-[16px] border-b border-solid border-border bg-surface px-[40px] max-md:px-[16px] ${
        action
          ? 'flex h-[64px] justify-between max-md:h-[56px]'
          : 'grid h-[64px] grid-cols-[minmax(max-content,1fr)_auto_minmax(0,1fr)] max-md:h-auto max-md:grid-cols-1 max-md:gap-[10px] max-md:py-[12px]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-[8px]">
        <div className="flex shrink-0 items-center gap-[7px]">
          <img alt="mice planner" src="/assets/mice-planner-logo.png" className="h-[11px] w-[116px] object-contain brightness-0" />
          <img alt="" src={`${A}/shared/group5.svg`} className="h-[26.758px] w-[21px]" />
        </div>
        <div className="h-[16px] w-px shrink-0 bg-border-strong" />
        <p className="whitespace-nowrap text-sm text-fg-secondary">Client Portal</p>
      </div>
      {action ? (
        <div className="flex shrink-0 items-center">{action}</div>
      ) : (
        <nav className="flex h-[48px] items-center gap-[2px] rounded-md bg-surface-sunken px-[5px]">
          {NAV.map((n) => {
            const on = n.key === active;
            return (
              <a
                key={n.key}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className={`flex h-[40px] items-center justify-center gap-[7px] rounded-md px-[12px] max-md:flex-1 ${on ? 'bg-surface text-fg' : 'text-fg-secondary hover:text-fg'}`}
              >
                <ClientIcon src={`${A}/shared/${n.icon}.svg`} className="size-[15px]" />
                <span className={`whitespace-nowrap text-base ${on ? 'font-medium' : 'font-normal'}`}>{n.label}</span>
              </a>
            );
          })}
        </nav>
      )}
    </header>
  );
}
