'use client';

import { useState } from 'react';
import { SegmentControl, TextTabs, Toggle } from '@miceplans/ui';

const A = '/assets/dashboard';
const SHADOW = 'shadow-card';



const PROPS: { icon: string; label: string; value: string }[] = [];

const TABS = ['스케줄', '할 일', '문서', '통계'];

const VIEW_OPTIONS: { value: 'Day' | 'Week' | 'Month'; label: string }[] = [
  { value: 'Day', label: 'Day' },
  { value: 'Week', label: 'Week' },
  { value: 'Month', label: 'Month' },
];

const SCHEDULES: { dot: string; state: string; stateColor: string; title: string; date: string }[] = [];

const TAB_ROWS: Record<string, typeof SCHEDULES> = {
  스케줄: SCHEDULES,
  '할 일': [],
  문서: [],
  통계: [],
};

type Task = { title: string; meta: string; done?: boolean };

const COLUMNS: { dot: string; title: string; count: number; pill: string; pillText: string; more: string; tasks: Task[] }[] = [];

const MORE_COLOR = ['text-error-delay', 'text-brand-deep', 'text-success-deep', 'text-fg-secondary'];

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
      </div>
      <div className="flex w-full items-center gap-[5px]">
        <img alt="" src={`${A}/meta-dot.svg`} className="size-[3px]" />
        <span className="whitespace-nowrap text-2xs text-fg-muted">{task.meta}</span>
      </div>
    </div>
  );
}

const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
const WEEK_START = (() => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t;
})();
const DAYS: { d: string; n: number; weekend?: boolean; today?: boolean }[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => {
  const date = new Date(WEEK_START.getFullYear(), WEEK_START.getMonth(), WEEK_START.getDate() + i);
  const isToday = date.toDateString() === new Date().toDateString();
  return { d, n: date.getDate(), weekend: i >= 5, today: isToday };
});
const WEEK_LABEL = `${WEEK_START.getMonth() + 1}월 ${WEEK_START.getDate()}~${new Date(WEEK_START.getFullYear(), WEEK_START.getMonth(), WEEK_START.getDate() + 6).getDate()}`;
const COL_BG: [string, number, number, string][] = [
  ['MON', 0, 150, 'bg-surface'], ['TUE', 150, 149, 'bg-surface'], ['WED', 294, 150, 'bg-brand-tint'], ['THU', 449, 150, 'bg-surface'],
  ['FRI', 599, 150, 'bg-surface'], ['SAT', 749, 149, 'bg-surface-sunken'], ['SUN', 898, 150, 'bg-surface-sunken'],
];
const VLINES = [147.43, 294.86, 442.29, 589.71, 737.14, 884.57];

type Ev = { title: string; time?: string; color: string; left: number; top: number; h: number; small?: boolean };
const EVENTS: Ev[] = [];

export function DashboardView() {
  const [isPublic, setIsPublic] = useState(true);
  const [tab, setTab] = useState('스케줄');
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const tabRows = TAB_ROWS[tab];

  return (
    <div className="flex w-full flex-col items-start gap-[20px] px-[28px] py-[24px] leading-[normal]">
      <div className="flex w-full flex-col items-start pb-[40px] pt-[44px]">
        <div className="flex w-full items-center gap-[12px]">
          <h1 className="m-0 whitespace-nowrap text-2xl font-bold text-fg">행사</h1>
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
            <span className="relative z-[2] mr-[-108px] shrink-0 text-3xl leading-[normal] tracking-[-0.7878px] text-fg-inverse"></span>
            <span className="relative z-[1] shrink-0 text-3xl leading-[168.583px] tracking-[-0.878px] text-fg-inverse/60"></span>
          </div>
        </div>
        <div className={`flex shrink-0 flex-col items-start rounded-md bg-surface p-[24px] ${SHADOW}`}>
          <div className="flex flex-col items-start gap-[24px]">
            <p className="m-0 text-xl font-semibold leading-[30.545px] tracking-[-0.1591px] text-fg-strong">할 일</p>
            <div className="flex flex-col items-start gap-[8px]">
            </div>
          </div>
        </div>
        <div className={`flex w-[270px] shrink-0 flex-col items-start self-stretch rounded-md bg-surface p-[24px] ${SHADOW}`}>
          <div className="flex w-[224px] flex-1 flex-col items-start gap-[24px]">
            <p className="m-0 text-xl font-semibold leading-[30.545px] tracking-[-0.1591px] text-fg-strong">새 알림</p>
          </div>
        </div>
      </div>

      <div className={`flex w-full flex-col items-start gap-[12px] rounded-md bg-surface px-[20px] py-[16px] ${SHADOW}`}>
        <div className="flex h-[30px] w-full shrink-0 items-center gap-[8px]">
          <button type="button" aria-label="이전 주" className="flex size-[30px] items-center justify-center rounded-full">
            <img alt="" src={`${A}/icon.svg`} className="size-[14px]" />
          </button>
          <span className="whitespace-nowrap text-lg font-bold text-fg">{WEEK_LABEL}</span>
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
