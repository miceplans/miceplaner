import type { ReactNode } from 'react';

const A = '/assets/client';

export type ClientNavKey = 'dashboard' | 'calendar';

const NAV: { key: ClientNavKey; label: string; href: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', href: '/client/dashboard', icon: 'layout-dashboard' },
  { key: 'calendar', label: '캘린더', href: '/client/calendar', icon: 'calendar' },
];

/** 클라이언트 포털 공통 헤더(로고 + 탭 내비게이션). action을 주면 탭 대신 그 요소(예: 로그인 버튼)를 오른쪽에 둔다. */
export function ClientHeader({ active = 'dashboard', action }: { active?: ClientNavKey; action?: ReactNode }): ReactNode {
  return (
    <header className="flex w-full shrink-0 items-start">
      <div
        className={`flex h-[64px] min-w-px flex-1 items-center justify-between gap-[24px] border-b border-solid border-border bg-surface px-[40px] max-md:px-[16px] ${
          action ? 'max-md:h-[56px]' : 'max-md:h-auto max-md:flex-col max-md:items-stretch max-md:gap-[8px] max-md:py-[12px]'
        }`}
      >
        <div className="flex shrink-0 items-center gap-[8px]">
          <div className="flex shrink-0 items-center gap-[7px]">
            <img alt="mice planner" src="/assets/mice-planner-logo.png" className="h-[11px] w-[116px] object-contain brightness-0" />
            <img alt="" src={`${A}/shared/group5.svg`} className="h-[26.758px] w-[21px]" />
          </div>
          <div className="h-[16px] w-px shrink-0 bg-border-strong" />
          <p className="whitespace-nowrap text-sm text-fg-secondary">고객 포털</p>
        </div>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : (
        <nav className="flex h-[48px] shrink-0 items-center gap-[2px] self-end rounded-md bg-surface-sunken px-[5px] max-md:w-full max-md:self-auto">
          {NAV.map((n) => {
            const on = n.key === active;
            return (
              <a
                key={n.key}
                href={n.href}
                className={`flex min-w-0 flex-1 items-center justify-center gap-[7px] rounded-md p-[12px] ${on ? 'bg-surface' : ''}`}
              >
                <img alt="" src={`${A}/shared/${n.icon}.svg`} className="size-[15px]" />
                <span
                  className={`whitespace-nowrap text-base ${on ? 'font-medium text-fg' : 'font-normal text-fg-secondary'}`}
                >
                  {n.label}
                </span>
              </a>
            );
          })}
        </nav>
        )}
      </div>
    </header>
  );
}
