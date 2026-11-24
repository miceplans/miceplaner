'use client';

import type { ReactNode } from 'react';
import { PageBody, PageTopbar } from './page-frame';
import { SIDEBAR_FRAME, SidebarLogo, SidebarNav, SidebarNavLink } from './sidebar';
import { StatusTag } from './status-tag';
import { statusTones, type StatusToneKey } from './tokens';

export type ClientNavKey = 'dashboard' | 'events' | 'calendar';

const NAV: { key: ClientNavKey; label: string; href: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', href: '/client/dashboard', icon: '/assets/client/shared/layout-dashboard.svg' },
  { key: 'events', label: '행사', href: '/client/events', icon: '/assets/sidebar/events.svg' },
  { key: 'calendar', label: '캘린더', href: '/client/calendar', icon: '/assets/sidebar/calendar.svg' },
];

/** Client 포털 사이드바. 내부 앱 사이드바와 같은 틀·로고·내비 항목을 쓰고, 포털 메뉴만 보여 준다. */
export function ClientSidebar({ active }: { active: ClientNavKey }): ReactNode {
  return (
    <aside className={SIDEBAR_FRAME} data-name="ClientSidebar">
      <SidebarLogo href="/client/dashboard" />
      <SidebarNav>
        {NAV.map((n) => (
          <SidebarNavLink key={n.key} href={n.href} icon={n.icon} label={n.label} active={n.key === active} />
        ))}
      </SidebarNav>
      <div className="min-h-[5px] flex-1 max-md:hidden" />
      <div className="flex h-[52px] shrink-0 items-center border-t border-solid border-border px-[14px] max-md:hidden">
        <span className="text-sm font-semibold text-fg-secondary">고객 포털</span>
      </div>
    </aside>
  );
}

/**
 * Client 포털 페이지 틀. 내부 AppShell과 같은 구조: 좌측 사이드바(240) + 상단바(h56) + 흰 본문.
 * Client는 내부 데이터에 접근하지 않으므로 사이드바 사용자·최근 항목·구성 수정은 두지 않는다.
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
    <div className="flex min-h-screen w-full bg-surface max-md:flex-col">
      <div className="sticky top-0 h-screen shrink-0 self-start max-md:static max-md:h-auto">
        <ClientSidebar active={active} />
      </div>
      <main className="flex min-w-0 flex-1 flex-col">
        <PageTopbar title={title}>{actions}</PageTopbar>
        <PageBody>{children}</PageBody>
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
