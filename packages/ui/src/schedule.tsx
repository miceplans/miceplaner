'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { SidePeekPanel, type AgendaItem } from './side-peek';

const A = '/assets/schedule';

/* ---------- 상태 pill ---------- */

export type StatusKey = '진행중' | '성공' | '확인중' | '만료' | '제출' | '보류중';

const STATUS: Record<StatusKey, { bg: string; fg: string }> = {
  진행중: { bg: 'bg-info-bg', fg: 'text-info' },
  성공: { bg: 'bg-success-bg', fg: 'text-success' },
  확인중: { bg: 'bg-warning-bg', fg: 'text-warning' },
  만료: { bg: 'bg-expired-bg', fg: 'text-expired' },
  제출: { bg: 'bg-submit-bg', fg: 'text-submit' },
  보류중: { bg: 'bg-warning-hold-bg', fg: 'text-warning-hold' },
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
    case '만료':
      return <img alt="" src={`${A}/c7e29.svg`} className="block size-[14px] shrink-0" />;
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
  const s = STATUS[status];
  return (
    <span className={`inline-flex h-[24px] items-center gap-[4px] rounded-sm px-[8px] ${s.bg}`}>
      <StatusIcon status={status} />
      <span className={`whitespace-nowrap text-xs font-bold ${s.fg}`}>{status}</span>
    </span>
  );
}

/* ---------- Topbar ---------- */

export function Topbar(): ReactNode {
  return (
    <div className="flex h-[56px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
      <button type="button" aria-label="사이드바 토글" className="flex size-[28px] shrink-0 items-center justify-center rounded-sm hover:bg-surface-chip">
        <img alt="" src={`${A}/6fc38.svg`} className="size-[16px]" />
      </button>
      <div className="flex h-full shrink-0 items-center gap-[6px] text-base">
        <span className="whitespace-nowrap text-fg-secondary">Workspace</span>
        <img alt="" src={`${A}/a7eff.svg`} className="size-[13px]" />
        <span className="whitespace-nowrap font-semibold text-fg">Schedules</span>
      </div>
      <div className="h-px min-w-px flex-1" />
      <label className="flex h-[32px] w-[280px] shrink-0 items-center gap-[8px] rounded-sm bg-surface-chip px-[10px] max-md:hidden">
        <img alt="" src={`${A}/1e4e7.svg`} className="size-[15px] shrink-0" />
        <input
          type="text"
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-tertiary"
        />
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface px-[5px] text-2xs text-fg-secondary">⌘K</span>
      </label>
      <button type="button" className="flex h-[30px] shrink-0 items-center gap-[6px] rounded-sm bg-brand px-[12px] text-base font-semibold text-fg-inverse hover:bg-brand max-md:hidden">
        <img alt="" src={`${A}/05c58.svg`} className="size-[14px]" />
        <span className="whitespace-nowrap">New 행사</span>
      </button>
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-xl bg-brand-tint text-2xs font-semibold text-brand">JY</span>
    </div>
  );
}

/* ---------- View tabs ---------- */

export type ViewTab = { label: string; icon: string; activeIcon?: string; href?: string };

export function ViewTabs({ tabs, active, bordered = false, onChange }: { tabs: ViewTab[]; active: number; bordered?: boolean; onChange?: (index: number) => void }): ReactNode {
  return (
    <div className={`flex h-[52px] w-full shrink-0 items-center overflow-x-auto px-[24px] max-md:px-[8px] ${bordered ? 'border-b border-solid border-border' : ''}`}>
      <div className="flex h-full min-w-max items-start gap-[2px]">
        {tabs.map((t, i) => {
          const on = i === active;
          const cls = `flex h-full items-center gap-[7px] px-[12px] text-base ${
            on ? 'border-b-2 border-solid border-brand font-medium text-brand' : 'text-fg-secondary hover:text-fg'
          }`;
          const body = (
            <>
              <img alt="" src={`${A}/${on && t.activeIcon ? t.activeIcon : t.icon}.svg`} className="size-[15px]" />
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
    </div>
  );
}

/* ---------- 월간 캘린더 ---------- */

export type ChipKey = 'invite' | 'design' | 'brochure' | 'ai' | 'rehearsal' | 'kimes' | 'kimesHome';

const CHIPS: Record<ChipKey, { label: string; bg: string; fg: string; dot: string }> = {
  invite: { label: '초청장 발송', bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: '9cd3e' },
  design: { label: '디자인 승인', bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: '9cd3e' },
  kimesHome: { label: 'KIMES 홈페이지', bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: '9cd3e' },
  brochure: { label: '브로슈어 인쇄', bg: 'bg-warning-hold', fg: 'text-fg-inverse', dot: 'e2e7c' },
  ai: { label: 'AI서밋 홈페이지', bg: 'bg-brand-pink-strong', fg: 'text-fg-inverse', dot: 'e2e7c' },
  rehearsal: { label: '리허설', bg: 'bg-error-brand', fg: 'text-fg-inverse', dot: 'e2e7c' },
  kimes: { label: 'KIMES 당일 운영', bg: 'bg-error-brand', fg: 'text-fg-inverse', dot: 'e2e7c' },
};

export type CalCell = { d?: number; today?: boolean; chips?: ChipKey[] };

const c = (d: number, ...chips: ChipKey[]): CalCell => ({ d, chips });
const BLANK: CalCell = {};

/** 2025년 3월 */
export const MARCH_2025: CalCell[][] = [
  [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, c(1)],
  [c(2), c(3, 'invite'), c(4), c(5, 'design'), { d: 6, today: true, chips: ['brochure'] }, c(7, 'brochure'), c(8, 'brochure')],
  [c(9, 'brochure'), c(10, 'brochure', 'ai'), c(11, 'ai'), c(12, 'ai', 'rehearsal'), c(13, 'ai', 'kimes'), c(14, 'ai', 'kimes'), c(15, 'kimes')],
  [c(16, 'kimes'), c(17), c(18), c(19), c(20), c(21), c(22)],
  [c(23), c(24, 'kimesHome'), c(25, 'kimesHome'), c(26, 'kimesHome'), c(27), c(28), c(29)],
  [c(30), c(31), BLANK, BLANK, BLANK, BLANK, BLANK],
];

/** 2025년 3월 날짜별 내 할 일·프로그램·태스크·서브태스크 */
const MARCH_AGENDA: Record<number, AgendaItem[]> = {
  3: [
    { kind: 'program', title: '초청장 발송', meta: 'KIMES' },
    { kind: 'task', title: '초청장 수신처 리스트 정리', meta: '최' },
  ],
  5: [
    { kind: 'todo', title: '디자인 시안 최종 확인' },
    { kind: 'task', title: 'KIMES 부스 3D 렌더링 수정', meta: '박' },
    { kind: 'subtask', title: '조명 재질 수정', meta: '박', done: true },
  ],
  6: [
    { kind: 'todo', title: '인쇄 업체 견적 회신 확인' },
    { kind: 'program', title: '브로슈어 인쇄', meta: 'KIMES' },
    { kind: 'task', title: '브로슈어 인쇄 견적 3사 비교', meta: '한' },
    { kind: 'subtask', title: '견적서 3부 수집', meta: '한', done: true },
    { kind: 'subtask', title: '단가 비교표 작성', meta: '한' },
  ],
  10: [
    { kind: 'program', title: 'AI서밋 홈페이지', meta: 'AI 서밋' },
    { kind: 'task', title: 'AI서밋 발표 자료 템플릿', meta: '김' },
  ],
  12: [
    { kind: 'todo', title: '리허설 동선 점검' },
    { kind: 'program', title: '리허설', meta: 'KIMES' },
    { kind: 'task', title: '리허설 장비 체크리스트 작성', meta: '최' },
    { kind: 'subtask', title: '음향 장비 목록 확인' },
  ],
  13: [
    { kind: 'program', title: 'KIMES 당일 운영', meta: 'KIMES' },
    { kind: 'task', title: '스태프 배치도 초안', meta: '박' },
  ],
  24: [{ kind: 'program', title: 'KIMES 홈페이지', meta: 'KIMES' }],
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function Chip({ k, onClick }: { k: ChipKey; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }): ReactNode {
  const ch = CHIPS[k];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[20px] w-fit shrink-0 cursor-pointer items-center gap-[4px] rounded-xs px-[6px] text-2xs font-medium hover:opacity-80 ${ch.bg} ${ch.fg}`}
    >
      <img alt="" src={`${A}/${ch.dot}.svg`} className="size-[5px]" />
      <span className="whitespace-nowrap">{ch.label}</span>
    </button>
  );
}

export function MonthCalendar({
  title,
  weeks,
  gridGap = 24,
  thickRows = [3],
  firstRowTopBorder = true,
  padX = 24,
}: {
  title: string;
  weeks: CalCell[][];
  gridGap?: number;
  /** 아래 경계선이 이중으로 보이는 주(0부터) */
  thickRows?: number[];
  firstRowTopBorder?: boolean;
  /** 그리드 좌우 여백(px) */
  padX?: number;
}): ReactNode {
  const last = weeks.length - 1;
  const [peek, setPeek] = useState<{ title: string; date: string; day: number } | null>(null);
  return (
    <div className="flex w-full flex-col items-center" style={{ gap: gridGap }}>
      {peek ? <SidePeekPanel title={peek.title} date={peek.date} agenda={MARCH_AGENDA[peek.day] ?? []} onClose={() => setPeek(null)} /> : null}
      <div className="flex shrink-0 items-center gap-[17.895px]">
        <button type="button" aria-label="이전 달" className="size-[26.842px] rounded-sm hover:bg-surface-chip">
          <img alt="" src={`${A}/4f176.svg`} className="size-full" />
        </button>
        <p className="whitespace-nowrap text-3xl font-semibold text-fg">{title}</p>
        <button type="button" aria-label="다음 달" className="size-[26.842px] rounded-sm hover:bg-surface-chip">
          <img alt="" src={`${A}/2e379.svg`} className="size-full" />
        </button>
      </div>
      <div className="flex w-full flex-1 flex-col items-center overflow-x-auto pb-[24px]" style={{ paddingInline: padX }}>
        <div className="flex h-[32px] w-full shrink-0 items-start bg-surface">
          {WEEKDAYS.map((w) => (
            <div key={w} className="flex h-full flex-1 items-center justify-center text-xs font-medium text-fg-tertiary">
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={`grid h-[102px] w-full shrink-0 grid-cols-7 items-start border-b border-solid border-border-strong ${
              wi === last ? 'rounded-b-md' : ''
            }`}
          >
            {week.map((cell, ci) => {
              const border = [
                'border-r border-solid border-border-soft',
                ci === 0 ? 'border-l' : '',
                wi === 0 && firstRowTopBorder ? 'border-t' : '',
                thickRows.includes(wi) ? 'border-b' : '',
                wi === last && ci === 0 ? 'rounded-bl-md' : '',
                wi === last && ci === 6 ? 'rounded-br-md' : '',
              ].join(' ');
              return (
                <div
                  key={ci}
                  onClick={cell.d === undefined ? undefined : () => setPeek({ title: `${cell.d}일 일정`, date: `${title} ${cell.d}일`, day: cell.d! })}
                  className={`flex h-full flex-col items-start gap-[4px] px-[8px] pb-[6px] pt-[8px] ${cell.d === undefined ? '' : 'cursor-pointer hover:bg-surface-muted'} ${
                    cell.d === undefined ? 'bg-surface-subtle' : 'bg-surface'
                  } ${border}`}
                >
                  {cell.today ? (
                    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-semibold text-fg-inverse">
                      {cell.d}
                    </span>
                  ) : cell.d !== undefined ? (
                    <span className="shrink-0 text-sm text-fg-secondary">{cell.d}</span>
                  ) : null}
                  {cell.chips?.map((k, i) => <Chip key={`${k}-${i}`} k={k} onClick={(e) => { e.stopPropagation(); setPeek({ title: CHIPS[k].label, date: `${title} ${cell.d}일`, day: cell.d! }); }} />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 사이드바 활성 탭 아이콘 세트 */
export const SCHEDULE_TABS: ViewTab[] = [
  { label: '전체 일정', icon: 'ffeb6', activeIcon: '753c4', href: '/schedule-table' },
  { label: '내 일정', icon: '10b86' },
  { label: 'Calendar', icon: 'b0b49', activeIcon: '85cb7', href: '/schedule-calendar' },
];
