'use client';

import { type ReactNode } from 'react';
import { statusTones, type StatusToneKey } from './tokens';
import { useSidebarToggle } from './sidebar';
import { TopbarSearch } from './topbar-search';

const A = '/assets/schedule';

/* ---------- 상태 pill ---------- */

export type StatusKey = '진행중' | '성공' | '확인중' | '실패' | '만료' | '보류중' | '제출' | '반려' | '종료';

const TONE_OF: Record<StatusKey, StatusToneKey> = {
  진행중: 'progress',
  성공: 'success',
  확인중: 'review',
  실패: 'error',
  만료: 'expired',
  보류중: 'hold',
  제출: 'submit',
  반려: 'reject',
  종료: 'closed',
};

function StatusIcon({ status }: { status: StatusKey }): ReactNode {
  switch (status) {
    case '진행중':
      return (
        <span className="relative size-[12px] shrink-0">
          <span className="absolute inset-[-5.83%]">
            <img alt="" src={`${A}/27ae9.svg`} className="block size-full max-w-none" />
          </span>
        </span>
      );
    case '성공':
      return <img alt="" src={`${A}/6bb8d.svg`} className="block size-[14.333px] shrink-0" />;
    case '확인중':
      return <img alt="" src={`${A}/698cb.svg`} className="block h-[11.828px] w-[12px] shrink-0" />;
    case '실패':
      return <img alt="" src={`${A}/032f3.svg`} className="block size-[14.167px] shrink-0" />;
    case '만료':
      return <img alt="" src={`${A}/9036d.svg`} className="block size-[14px] shrink-0" />;
    case '반려':
      return <img alt="" src={`${A}/414d1.svg`} className="block size-[14px] shrink-0" />;
    case '종료':
      return <img alt="" src={`${A}/45faa.svg`} className="block h-[7.755px] w-[15px] shrink-0" />;
    case '보류중':
      return <img alt="" src={`${A}/36f5f.svg`} className="block h-[11.046px] w-[12.596px] shrink-0" />;
    case '제출':
      return (
        <span className="flex h-[16.158px] w-[16.4px] shrink-0 items-center justify-center">
          <span className="relative block h-[12px] w-[12.5px] flex-none rotate-[25deg]">
            <span className="absolute inset-[3.88%_4.83%_3.84%_4.23%]">
              <img alt="" src={`${A}/0cf85.svg`} className="block size-full max-w-none" />
            </span>
          </span>
        </span>
      );
  }
}

export function StatusPill({ status }: { status: StatusKey }): ReactNode {
  const tone = statusTones[TONE_OF[status]];
  return (
    <span className="inline-flex h-[24px] items-center gap-[4px] rounded-sm px-[8px]" style={{ background: tone.bg }}>
      <StatusIcon status={status} />
      <span className="whitespace-nowrap text-xs font-bold" style={{ color: tone.fg }}>{tone.label}</span>
    </span>
  );
}

/* ---------- Topbar ---------- */

export function Topbar(): ReactNode {
  const toggleSidebar = useSidebarToggle();
  return (
    <div className="flex h-[56px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
      <button type="button" aria-label="사이드바 토글" onClick={toggleSidebar} className="flex size-[28px] shrink-0 items-center justify-center rounded-sm hover:bg-surface-chip">
        <img alt="" src={`${A}/6fc38.svg`} className="size-[16px]" />
      </button>
      <div className="flex h-full shrink-0 items-center gap-[6px] text-base">
        <span className="whitespace-nowrap text-fg-secondary">워크스페이스</span>
        <img alt="" src={`${A}/a7eff.svg`} className="size-[13px]" />
        <span className="whitespace-nowrap font-semibold text-fg">일정</span>
      </div>
      <div className="h-px min-w-px flex-1" />
      <TopbarSearch className="max-md:hidden" />
      <a href="/events/new" className="flex h-[30px] shrink-0 items-center gap-[6px] rounded-sm bg-brand px-[12px] text-base font-semibold text-fg-inverse hover:bg-brand max-md:hidden">
        <img alt="" src={`${A}/05c58.svg`} className="size-[14px]" />
        <span className="whitespace-nowrap">행사 추가</span>
      </a>
    </div>
  );
}

/* ---------- View tabs ---------- */

export type ViewTab = { label: string; icon: string; activeIcon?: string; href?: string };

/** `/`로 시작하면 전체 경로, 아니면 `/assets/schedule` 아래 파일명으로 해석한다. */
const tabIcon = (name: string): string => (name.startsWith('/') ? name : `${A}/${name}.svg`);

export function ViewTabs({ tabs, active, bordered = false, onChange, action }: { tabs: ViewTab[]; active: number; bordered?: boolean; onChange?: (index: number) => void; action?: ReactNode }): ReactNode {
  return (
    <div className={`flex h-[52px] w-full shrink-0 items-center px-[24px] max-md:px-[8px] ${bordered ? 'border-b border-solid border-border' : ''}`}>
      <div className="flex h-full min-w-max items-start gap-[2px]">
        {tabs.map((t, i) => {
          const on = i === active;
          const cls = `flex h-full items-center gap-[7px] px-[12px] text-base ${
            on ? 'border-b-2 border-solid border-brand font-medium text-brand' : 'text-fg-secondary hover:text-fg'
          }`;
          const body = (
            <>
              <img alt="" src={tabIcon(on && t.activeIcon ? t.activeIcon : t.icon)} className="size-[15px]" />
              <span className="whitespace-nowrap">{t.label}</span>
            </>
          );
          return t.href ? (
            <a key={t.label} href={t.href} className={cls} aria-current={on ? 'page' : undefined}>
              {body}
            </a>
          ) : (
            <button key={t.label} type="button" onClick={() => onChange?.(i)} className={cls}>
              {body}
            </button>
          );
        })}
      </div>
      {action ? <div className="ml-auto flex shrink-0 items-center">{action}</div> : null}
    </div>
  );
}

/* 사이드바 활성 탭 아이콘 세트. '전체 일정' 표는 정리되어 빠졌다. */
export const SCHEDULE_TABS: ViewTab[] = [
  { label: '내 일정', icon: '10b86' },
  { label: '캘린더', icon: 'b0b49', activeIcon: '85cb7', href: '/schedule-calendar' },
];
