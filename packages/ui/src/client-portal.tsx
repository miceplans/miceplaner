'use client';

import type { ReactNode } from 'react';
import { StatusTag } from './status-tag';
import { statusTones, type StatusToneKey } from './tokens';

const A = '/assets/client';

export type ClientNavKey = 'dashboard' | 'events' | 'calendar';

type HeaderNavKey = 'dashboard' | 'calendar';

const NAV: { key: HeaderNavKey; label: string; href: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', href: '/client/dashboard', icon: 'layout-dashboard' },
  { key: 'calendar', label: '캘린더', href: '/client/calendar', icon: 'calendar' },
];

/** 클라이언트 포털 공통 헤더(로고 + 탭 내비게이션). 행사 목록·상세는 대시보드 탭에 속한다. */
export function ClientHeader({ active = 'dashboard' }: { active?: ClientNavKey }): ReactNode {
  const current: HeaderNavKey = active === 'calendar' ? 'calendar' : 'dashboard';
  return (
    <header className="sticky top-0 z-10 flex w-full shrink-0 items-start">
      <div className="flex h-[64px] min-w-px flex-1 items-center justify-between gap-[24px] border-b border-solid border-border bg-surface px-[40px] max-md:h-auto max-md:flex-col max-md:items-stretch max-md:gap-[8px] max-md:px-[16px] max-md:py-[12px]">
        <a href="/client/dashboard" className="flex shrink-0 items-center gap-[8px]">
          <div className="flex shrink-0 items-center gap-[7px]">
            <img alt="mice planner" src="/assets/mice-planner-logo.png" className="h-[11px] w-[116px] object-contain brightness-0" />
            <img alt="" src={`${A}/shared/group5.svg`} className="h-[26.758px] w-[21px]" />
          </div>
          <div className="h-[16px] w-px shrink-0 bg-border-strong" />
          <p className="whitespace-nowrap text-sm text-fg-secondary">고객 포털</p>
        </a>
        <nav className="flex h-[48px] shrink-0 items-center gap-[2px] self-end rounded-md bg-surface-sunken px-[5px] max-md:w-full max-md:self-auto">
          {NAV.map((n) => {
            const on = n.key === current;
            return (
              <a
                key={n.key}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className={`flex min-w-0 flex-1 items-center justify-center gap-[7px] rounded-md p-[12px] ${on ? 'bg-surface' : ''}`}
              >
                <img alt="" src={`${A}/shared/${n.icon}.svg`} className="size-[15px]" />
                <span className={`whitespace-nowrap text-base ${on ? 'font-medium text-fg' : 'font-normal text-fg-secondary'}`}>{n.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/**
 * Client 포털 페이지 틀. 포털 전용 `ClientHeader`(h64) 아래에 페이지 제목 행과 본문을 둔다.
 * 본문은 화면 폭을 따라 늘어나되 최대 1200px로 가운데 정렬한다(고정 폭 금지).
 */
export function ClientShell({
  active,
  title,
  actions,
  children,
}: {
  active: ClientNavKey;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active={active} />
      <main className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-1 flex-col gap-[16px] px-[40px] py-[32px] max-md:px-[16px] max-md:py-[20px]">
        <div className="flex min-h-[32px] w-full flex-wrap items-center justify-between gap-[12px]">
          {typeof title === 'string' ? <h1 className="text-xl font-bold text-fg">{title}</h1> : title}
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}

/** 본문 안 구획 제목(Subtitle 13/600)과 우측 링크. */
export function SectionHeader({ title, link }: { title: string; link?: { label: string; href: string } }): ReactNode {
  return (
    <div className="flex w-full items-center justify-between gap-[8px]">
      <h2 className="whitespace-nowrap text-base font-semibold text-fg">{title}</h2>
      {link ? (
        <a href={link.href} className="whitespace-nowrap text-xs font-medium text-fg-secondary hover:text-fg">
          {link.label} ›
        </a>
      ) : null}
    </div>
  );
}

export type PortalState = '예정' | '진행중' | '완료';

const PORTAL_TONE: Record<PortalState, StatusToneKey> = { 예정: 'scheduled', 진행중: 'progress', 완료: 'success' };

/** 상태별 배경·글자색(statusTones). 달력 칩처럼 StatusTag가 아닌 곳에서 같은 톤을 쓸 때 사용한다. */
export const portalStateTone = (state: PortalState): { bg: string; fg: string } => statusTones[PORTAL_TONE[state]];

/** 행사·Program 일정 상태 필. 디자인 시스템 StatusTag 톤을 쓴다(완료=success 톤). */
export function PortalStateTag({ state }: { state: PortalState }): ReactNode {
  return <StatusTag status={PORTAL_TONE[state]} label={state} />;
}

/** D-day 칩(New/DDay 칩 규격: ai-tint 배경). */
export function DdayChip({ children }: { children: ReactNode }): ReactNode {
  return <span className="flex h-[24px] shrink-0 items-center whitespace-nowrap rounded-sm bg-ai-tint px-[8px] text-xs font-bold text-ai">{children}</span>;
}
