'use client';

import { useState } from 'react';
import { SegmentControl, TextTabs, Toggle } from '@miceplans/ui';

const A = '/assets/dashboard';
const SHADOW = 'shadow-card';

// 목업 기준일('오늘'): 2026-10-22. D-day 계산에 사용하는 고정 상수다.
const MOCK_TODAY = new Date(2026, 9, 22);
const BIPC_START = new Date(2026, 10, 5); // BIPC 행사 시작일(2026-11-05)

function dDayLabel(start: Date): string {
  const diff = Math.round((start.getTime() - MOCK_TODAY.getTime()) / 86400000);
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : '종료';
}

const BIPC_DDAY = dDayLabel(BIPC_START);

const PROPS: { icon: string; label: string; value: string }[] = [
  { icon: 'prop-icon1', label: 'Client', value: '메디코리아' },
  { icon: 'prop-icon2', label: 'PM', value: '박서연' },
  { icon: 'prop-icon2', label: 'AM', value: '최민준' },
  { icon: 'prop-icon3', label: '기간', value: '2026. 03. 13 – 03. 16' },
  { icon: 'prop-icon4', label: '장소', value: '코엑스 Hall A·B' },
];

const TABS = ['스케줄', '할 일', '문서', '통계'];

const VIEW_OPTIONS: { value: 'Day' | 'Week' | 'Month'; label: string }[] = [
  { value: 'Day', label: 'Day' },
  { value: 'Week', label: 'Week' },
  { value: 'Month', label: 'Month' },
];

const SCHEDULES: { dot: string; state: string; stateColor: string; title: string; date: string; who: string }[] = [
  { dot: 'status-dot', state: '완료', stateColor: 'text-fg-tertiary', title: '홈페이지 오픈', date: '02.24', who: '박' },
  { dot: 'status-dot', state: '완료', stateColor: 'text-fg-tertiary', title: '초청장 발송', date: '03.03', who: '최' },
  { dot: 'status-dot1', state: '지연', stateColor: 'text-error-delay', title: '브로슈어 인쇄', date: '03.06', who: '한' },
  { dot: 'status-dot', state: '완료', stateColor: 'text-fg-tertiary', title: '디자인 승인', date: '03.05', who: '박' },
  { dot: 'status-dot2', state: '예정', stateColor: 'text-brand-blue', title: '리허설', date: '03.12', who: '최' },
  { dot: 'status-dot2', state: '예정', stateColor: 'text-brand-blue', title: '행사 당일 운영', date: '03.13 – 03.16', who: '박' },
];

const TAB_ROWS: Record<string, typeof SCHEDULES> = {
  스케줄: SCHEDULES,
  '할 일': [
    { dot: 'status-dot1', state: '지연', stateColor: 'text-error-delay', title: '브로슈어 인쇄 견적 3사 비교', date: '03.06', who: '한' },
    { dot: 'status-dot2', state: '진행', stateColor: 'text-brand-blue', title: '리허설 장비 체크리스트 작성', date: '03.10', who: '최' },
  ],
  문서: [
    { dot: 'status-dot2', state: '최근', stateColor: 'text-brand-blue', title: '행사 운영 매뉴얼 v2', date: '오늘', who: '박' },
    { dot: 'status-dot', state: '완료', stateColor: 'text-fg-tertiary', title: '부스 설치 도면.pdf', date: '어제', who: '최' },
  ],
  통계: [
    { dot: 'status-dot2', state: '진행', stateColor: 'text-brand-blue', title: '준비 항목 완료율 68%', date: '12 / 18', who: '박' },
    { dot: 'status-dot1', state: '주의', stateColor: 'text-error-delay', title: '마감 임박 항목 2건', date: '이번 주', who: '한' },
  ],
};

type Av = [string, string];
type Task = { title: string; meta: string; avatars: Av[]; done?: boolean };
const AV: Record<string, string> = { SJ: 'bg-brand-blue', MK: 'bg-brand-green', TR: 'bg-brand-amber', DN: 'bg-brand-pink', JP: 'bg-brand-green', AL: 'bg-brand' };
const av = (...k: string[]): Av[] => k.map((x) => [x, AV[x]!]);

const COLUMNS: { dot: string; title: string; count: number; pill: string; pillText: string; more: string; tasks: Task[] }[] = [
  {
    dot: 'dot', title: '진행', count: 5, pill: 'bg-info-bg', pillText: 'text-error-delay', more: '+ 3 more',
    tasks: [
      { title: 'Onboarding flow v2', meta: 'Due Today · 4 comments', avatars: av('SJ', 'MK', 'TR') },
      { title: 'Mobile navigation', meta: 'Due Wednesday', avatars: av('DN', 'JP') },
    ],
  },
  {
    dot: 'dot1', title: '편집', count: 2, pill: 'bg-brand-tint', pillText: 'text-brand-deep', more: '+ 2 more',
    tasks: [
      { title: 'Brand guidelines', meta: 'Due Today', avatars: av('MK', 'AL') },
      { title: 'Case study · Acme', meta: 'Due Monday', avatars: av('TR') },
    ],
  },
  {
    dot: 'dot2', title: '완료', count: 8, pill: 'bg-success-bg', pillText: 'text-success-deep', more: '+ 6 more',
    tasks: [
      { title: 'Pricing page revamp', meta: 'Shipped May 12', avatars: av('SJ', 'MK'), done: true },
      { title: 'Design tokens v1.2', meta: 'Shipped May 10', avatars: av('AL'), done: true },
    ],
  },
  {
    dot: 'dot3', title: '보류', count: 3, pill: 'bg-surface-section', pillText: 'text-fg-secondary', more: '+ 5 more',
    tasks: [
      { title: 'Website copy rewrite', meta: 'Due Tomorrow', avatars: av('SJ', 'MK') },
      { title: 'Q3 research plan', meta: 'Due Friday', avatars: av('AL') },
    ],
  },
];

const MORE_COLOR = ['text-error-delay', 'text-brand-deep', 'text-success-deep', 'text-fg-secondary'];

function AvatarStack({ avatars }: { avatars: Av[] }) {
  return (
    <div className="relative h-[18px] shrink-0" style={{ width: avatars.length === 1 ? 18 : 18 + (avatars.length - 1) * 12 }}>
      {avatars.map(([t, c], i) => (
        <div
          key={t}
          className={`absolute top-0 flex size-[18px] items-center justify-center rounded-md border-2 border-solid border-surface text-2xs font-bold text-fg-inverse ${c}`}
          style={{ left: i * 12 }}
        >
          <span className="relative -top-px">{t}</span>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="flex w-full shrink-0 flex-col items-start gap-[7px] rounded-xl bg-surface-muted px-[11px] py-[10px]">
      <div className="flex w-full items-center gap-[8px]">
        {task.done ? (
          <div className="flex size-[17px] shrink-0 items-center justify-center rounded-sm bg-success-solid">
            <img alt="" src={`${A}/check-icon.svg`} className="size-[10px]" />
          </div>
        ) : (
          <div className="size-[17px] shrink-0 rounded-sm border-[1.5px] border-solid border-border-placeholder" />
        )}
        <span className={`whitespace-nowrap text-xs font-semibold ${task.done ? 'text-fg-secondary' : 'text-fg'}`}>{task.title}</span>
        <div className="h-px min-w-px flex-1" />
        <AvatarStack avatars={task.avatars} />
      </div>
      <div className="flex w-full items-center gap-[5px]">
        <img alt="" src={`${A}/meta-dot.svg`} className="size-[3px]" />
        <span className="whitespace-nowrap text-2xs text-fg-muted">{task.meta}</span>
      </div>
    </div>
  );
}

function MiniTask({ title, meta, h37 }: { title: string; meta?: string; h37?: boolean }) {
  return (
    <div className={`flex shrink-0 flex-col items-start rounded-md bg-surface-muted px-[11px] py-[10px] ${h37 ? 'h-[37px] justify-between' : ''}`} style={{ width: meta ? 412 : 224 }}>
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-[8px]">
          {meta ? <div className="size-[17px] shrink-0 rounded-sm border-[1.5px] border-solid border-border-placeholder" /> : null}
          <span className="whitespace-nowrap text-xs font-semibold text-fg">{title}</span>
        </div>
        {meta ? <span className="whitespace-nowrap text-2xs text-fg-muted">{meta}</span> : null}
      </div>
    </div>
  );
}

const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
const DAYS: { d: string; n: number; weekend?: boolean; today?: boolean }[] = [
  { d: 'MON', n: 12 }, { d: 'TUE', n: 13 }, { d: 'WED', n: 14, today: true }, { d: 'THU', n: 15 },
  { d: 'FRI', n: 16 }, { d: 'SAT', n: 17, weekend: true }, { d: 'SUN', n: 18, weekend: true },
];
const COL_BG: [string, number, number, string][] = [
  ['MON', 0, 150, 'bg-surface'], ['TUE', 150, 149, 'bg-surface'], ['WED', 294, 150, 'bg-brand-tint'], ['THU', 449, 150, 'bg-surface'],
  ['FRI', 599, 150, 'bg-surface'], ['SAT', 749, 149, 'bg-surface-sunken'], ['SUN', 898, 150, 'bg-surface-sunken'],
];
const VLINES = [147.43, 294.86, 442.29, 589.71, 737.14, 884.57];

type Ev = { title: string; time?: string; color: string; left: number; top: number; h: number; small?: boolean };
const EVENTS: Ev[] = [
  { title: 'Design Review', time: '10:00 – 11:30 AM', color: 'bg-brand-pink-strong', left: 3, top: 50, h: 68 },
  { title: 'Team Sync', color: 'bg-brand-amber', left: 3, top: 242, h: 44, small: true },
  { title: 'Sprint Planning', time: '9:30 – 11:00 AM', color: 'bg-brand-amber', left: 150.43, top: 26, h: 68 },
  { title: 'Client Call', time: '1:00 – 2:30 PM', color: 'bg-brand-amber', left: 150.43, top: 194, h: 68 },
  { title: '1:1 · Sara', color: 'bg-error-brand', left: 150.43, top: 338, h: 44, small: true },
  { title: 'Standup', color: 'bg-brand-amber', left: 297.86, top: 2, h: 44, small: true },
  { title: 'UX Workshop', time: '11:00 AM – 1:00 PM', color: 'bg-error-brand', left: 297.86, top: 98, h: 92 },
  { title: 'Roadmap Review', time: '3:00 – 4:30 PM', color: 'bg-brand-pink-strong', left: 297.86, top: 290, h: 68 },
  { title: 'Design Critique', time: '10:30 – 12:00 PM', color: 'bg-brand-amber', left: 445.29, top: 74, h: 68 },
  { title: 'Interview · FE', time: '2:00 – 3:30 PM', color: 'bg-warning-hold', left: 445.29, top: 242, h: 68 },
  { title: 'Retro', color: 'bg-warning-hold', left: 592.71, top: 2, h: 44, small: true },
  { title: 'Demo Day', color: 'bg-brand-pink-strong', left: 592.71, top: 98, h: 44, small: true },
  { title: 'Design Sprint', time: '2:00 – 4:00 PM', color: 'bg-brand-amber', left: 592.71, top: 242, h: 92 },
  { title: 'Team Lunch', time: '11:30 AM – 1:00 PM', color: 'bg-error-brand', left: 740.14, top: 98, h: 68 },
];

export function DashboardView() {
  const [isPublic, setIsPublic] = useState(true);
  const [tab, setTab] = useState('스케줄');
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const tabRows = TAB_ROWS[tab];

  return (
    <div className="flex w-full flex-col items-start gap-[20px] px-[28px] py-[24px] leading-[normal]">
      <div className="flex w-full flex-col items-start pb-[40px] pt-[44px]">
        <div className="flex w-full items-center gap-[12px]">
          <h1 className="m-0 whitespace-nowrap text-2xl font-bold text-fg">제54회 KIMES 2025</h1>
          <div className="h-px min-w-px flex-1" />
          <div className="flex items-center gap-[8px]">
            <span className="whitespace-nowrap text-base text-fg-secondary">Client에게 공개</span>
            <Toggle checked={isPublic} onChange={setIsPublic} ariaLabel="Client에게 공개" />
          </div>
        </div>
        <div className="flex w-full flex-col items-start pb-[18px] pt-[22px]">
          <div className="flex h-[32px] w-full items-center gap-[10px]">
            <img alt="" src={`${A}/prop-icon.svg`} className="size-[15px]" />
            <span className="h-[19px] w-[96px] text-md text-fg-secondary">상태</span>
            <div className="flex items-center gap-[4px] rounded-sm bg-info-bg px-[8px] py-[5px]">
              <span className="relative size-[12px] shrink-0">
                <img alt="" src={`${A}/ellipse24.svg`} className="absolute inset-[-5.83%] block size-[calc(100%+11.66%)] max-w-none" />
              </span>
              <span className="whitespace-nowrap text-xs font-bold text-info">진행중</span>
            </div>
          </div>
          {PROPS.map((p) => (
            <div key={p.label} className="flex h-[32px] w-full items-center gap-[10px]">
              <img alt="" src={`${A}/${p.icon}.svg`} className="size-[15px]" />
              <span className="h-[19px] w-[96px] text-md text-fg-secondary">{p.label}</span>
              <span className="whitespace-nowrap text-md text-fg">{p.value}</span>
            </div>
          ))}
        </div>
        <div className="h-px w-full bg-border-soft" />
        <div className="flex w-full flex-col items-start">
          <TextTabs tabs={TABS} active={tab} onChange={setTab} />
          <div className="flex w-full flex-col items-start py-[8px]">
            {tabRows.map((s) => (
              <div key={s.title} className="flex h-[36px] w-full items-center gap-[10px]">
                <img alt="" src={`${A}/${s.dot}.svg`} className="size-[7px]" />
                <span className={`whitespace-nowrap text-xs ${s.stateColor}`}>{s.state}</span>
                <span className="whitespace-nowrap text-md text-fg">{s.title}</span>
                <div className="h-px min-w-px flex-1" />
                <span className="whitespace-nowrap text-base text-fg-secondary">{s.date}</span>
                <span className="flex size-[22px] items-center justify-center rounded-lg bg-brand-tint text-2xs font-semibold text-brand">{s.who}</span>
              </div>
            ))}
            <div className="flex h-[36px] w-full items-center gap-[8px] px-[17px]">
              <img alt="" src={`${A}/plus-icon.svg`} className="size-[14px]" />
              <span className="whitespace-nowrap text-base text-fg-tertiary">새 {tab} 추가</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-start gap-[16px]">
        {COLUMNS.map((c, ci) => (
          <div key={c.title} className={`flex min-w-px flex-1 flex-col items-start gap-[10px] self-stretch rounded-md bg-surface p-[14px] ${SHADOW}`}>
            <div className="flex w-full items-center gap-[8px]">
              <img alt="" src={`${A}/${c.dot}.svg`} className="size-[8px]" />
              <span className="whitespace-nowrap text-base font-bold text-fg">{c.title}</span>
              <div className="h-px min-w-px flex-1" />
              <span className={`flex items-center justify-center self-stretch rounded-full px-[9px] py-[2px] text-2xs font-bold ${c.pill} ${c.pillText}`}>{c.count}</span>
            </div>
            {c.tasks.map((t) => (
              <TaskCard key={t.title} task={t} />
            ))}
            <div className="flex w-full items-start p-[2px]">
              <span className={`whitespace-nowrap text-2xs font-semibold ${MORE_COLOR[ci]}`}>{c.more}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex w-full items-center gap-[20px] px-[5px]">
        <div
          className={`bg-brand-gradient relative w-[369px] shrink-0 self-stretch rounded-2xl border-[10px] border-solid border-brand-pink ${SHADOW}`}
        >
          <div className="absolute inset-[24px] isolate flex items-end whitespace-nowrap font-bold">
            <span className="relative z-[2] mr-[-108px] shrink-0 text-3xl leading-[normal] tracking-[-0.7878px] text-fg-inverse">BIPC</span>
            <span className="relative z-[1] shrink-0 text-3xl leading-[168.583px] tracking-[-0.878px] text-fg-inverse/60">{BIPC_DDAY}</span>
          </div>
        </div>
        <div className={`flex shrink-0 flex-col items-start rounded-md bg-surface p-[24px] ${SHADOW}`}>
          <div className="flex flex-col items-start gap-[24px]">
            <p className="m-0 text-xl font-semibold leading-[30.545px] tracking-[-0.1591px] text-fg-strong">할 일</p>
            <div className="flex flex-col items-start gap-[8px]">
              <MiniTask title="연사자 정리" meta="~10/24" h37 />
              <MiniTask title="연사자 정리" meta="~10/24" />
              <MiniTask title="연사자 정리" meta="~10/24" h37 />
            </div>
          </div>
        </div>
        <div className={`flex w-[270px] shrink-0 flex-col items-start self-stretch rounded-md bg-surface p-[24px] ${SHADOW}`}>
          <div className="flex w-[224px] flex-1 flex-col items-start gap-[24px]">
            <p className="m-0 text-xl font-semibold leading-[30.545px] tracking-[-0.1591px] text-fg-strong">새 알림</p>
            <MiniTask title="[BIPC] 포스터 변경 부탁드립니다." h37 />
          </div>
        </div>
      </div>

      <div className={`flex w-full flex-col items-start gap-[12px] rounded-md bg-surface px-[20px] py-[16px] ${SHADOW}`}>
        <div className="flex h-[30px] w-full shrink-0 items-center gap-[8px]">
          <button type="button" aria-label="이전 주" className="flex size-[30px] items-center justify-center rounded-full">
            <img alt="" src={`${A}/icon.svg`} className="size-[14px]" />
          </button>
          <span className="whitespace-nowrap text-lg font-bold text-fg">10월 12~18</span>
          <button type="button" aria-label="다음 주" className="flex size-[30px] items-center justify-center rounded-full">
            <img alt="" src={`${A}/icon1.svg`} className="size-[14px]" />
          </button>
          <div className="h-px min-w-px flex-1" />
          <SegmentControl size="md" options={VIEW_OPTIONS} value={view} onChange={setView} />
        </div>
        <div className="flex w-full items-start">
          <div className="h-[42px] w-[56px] shrink-0" />
          {DAYS.map((d) =>
            d.today ? (
              <div key={d.d} className="flex h-[42px] min-w-px flex-1 flex-col items-center justify-center">
                <div className="flex flex-col items-center rounded-md bg-brand px-[10px] py-[3px] leading-[normal]">
                  <span className="text-2xs font-bold tracking-[0.9px] text-fg-inverse/77">{d.d}</span>
                  <span className="text-base font-extrabold text-fg-inverse">{d.n}</span>
                </div>
              </div>
            ) : (
              <div key={d.d} className={`flex h-[42px] min-w-px flex-1 flex-col items-center justify-center gap-[2px] leading-[normal] ${d.weekend ? 'text-fg-muted' : ''}`}>
                <span className={`text-2xs font-bold tracking-[0.9px] ${d.weekend ? '' : 'text-fg-muted'}`}>{d.d}</span>
                <span className={`text-base font-bold ${d.weekend ? '' : 'text-fg'}`}>{d.n}</span>
              </div>
            ),
          )}
        </div>
        <div className="flex w-full items-start">
          <div className="relative h-[486px] w-[56px] shrink-0 text-2xs font-semibold leading-[normal] text-fg-muted">
            {HOURS.map((h, i) => (
              <span key={h} className="absolute left-0 h-[14px] w-[44px] text-right" style={{ top: i === 0 ? 0 : i * 48 - 6 }}>
                {h}
              </span>
            ))}
          </div>
          <div className="relative h-[486px] min-w-px flex-1 overflow-clip">
            {COL_BG.map(([k, l, w, bg]) => (
              <div key={k} className={`absolute top-0 h-[480px] ${bg}`} style={{ left: l, width: w }} />
            ))}
            {Array.from({ length: 11 }, (_, i) => (
              <div key={i} className="absolute left-0 h-px w-[1048px] bg-surface-cell" style={{ top: i * 48 }} />
            ))}
            {VLINES.map((l) => (
              <div key={l} className="absolute top-0 h-[480px] w-px bg-surface-cell" style={{ left: l }} />
            ))}
            {EVENTS.map((e) => (
              <div
                key={e.title}
                className={`absolute flex w-[141.429px] flex-col items-start justify-center rounded-lg px-[9px] ${e.color} ${e.time ? 'gap-px py-[7px]' : 'py-[5px]'}`}
                style={{ left: e.left, top: e.top, height: e.h }}
              >
                <div className="flex w-full items-center gap-[5px]">
                  <img alt="" src={`${A}/dot4.svg`} className="size-[5px]" />
                  <span
                    className={`min-w-px flex-1 text-2xs text-fg-inverse ${e.small ? 'font-preahvihear' : 'font-bold'}`}
                  >
                    {e.title}
                  </span>
                </div>
                {e.time ? <span className="whitespace-nowrap text-2xs font-medium text-fg-inverse opacity-85">{e.time}</span> : null}
              </div>
            ))}
            <div className="absolute left-[295px] top-[264px] h-[2px] w-[148px] bg-brand" />
          </div>
        </div>
      </div>
    </div>
  );
}
