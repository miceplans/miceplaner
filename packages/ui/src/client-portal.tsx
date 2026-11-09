import type { ReactNode } from 'react';
import { statusTones, type StatusToneKey } from './tokens';

const A = '/assets/client';

export type ClientNavKey = 'dashboard' | 'calendar' | 'inbox';

const NAV: { key: ClientNavKey; label: string; href: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', href: '/client/dashboard', icon: 'layout-dashboard' },
  { key: 'calendar', label: '캘린더', href: '/client/calendar', icon: 'calendar' },
  { key: 'inbox', label: '문의함', href: '/client/notifications', icon: 'inbox' },
];

/** 클라이언트 포털 공통 헤더(로고 + 탭 내비게이션). */
export function ClientHeader({ active = 'dashboard' }: { active?: ClientNavKey }): ReactNode {
  return (
    <header className="flex w-full shrink-0 items-start">
      <div className="flex h-[64px] min-w-px flex-1 items-center justify-between gap-[24px] border-b border-solid border-border bg-surface px-[40px] max-md:h-auto max-md:flex-col max-md:items-stretch max-md:gap-[8px] max-md:px-[16px] max-md:py-[12px]">
        <div className="flex shrink-0 items-center gap-[8px]">
          <div className="flex shrink-0 items-center gap-[7px]">
            <img alt="mice planner" src="/assets/mice-planner-logo.png" className="h-[11px] w-[116px] object-contain brightness-0" />
            <img alt="" src={`${A}/shared/group5.svg`} className="h-[26.758px] w-[21px]" />
          </div>
          <div className="h-[16px] w-px shrink-0 bg-border-strong" />
          <p className="whitespace-nowrap text-sm text-fg-secondary">고객 포털</p>
        </div>
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
      </div>
    </header>
  );
}

export type PrepStatus = '진행중' | '성공' | '확인중';

const PILL: Record<PrepStatus, { tone: StatusToneKey; icon: string; box: string; extra?: string }> = {
  진행중: { tone: 'progress', icon: 'ellipse24', box: 'size-[12px]' },
  성공: { tone: 'success', icon: 'vector', box: 'size-[14.333px]', extra: 'h-[24px]' },
  확인중: { tone: 'review', icon: 'vector1', box: 'h-[11.828px] w-[12px]' },
};

/** 준비 항목 상태 알약. */
export function ClientStatusPill({ status }: { status: PrepStatus }): ReactNode {
  const p = PILL[status];
  const tone = statusTones[p.tone];
  return (
    <div className={`flex shrink-0 items-center gap-[4px] rounded-sm px-[8px] py-[5px] ${p.extra ?? ''}`} style={{ background: tone.bg }}>
      <img alt="" src={`${A}/dashboard/${p.icon}.svg`} className={`shrink-0 ${p.box}`} />
      <p className="whitespace-nowrap text-xs font-bold" style={{ color: tone.fg }}>{tone.label}</p>
    </div>
  );
}
