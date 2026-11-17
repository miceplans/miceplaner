import { SCHEDULE_TABS, StatusPill, Topbar, ViewTabs, type StatusKey } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';

const A = '/assets/schedule';

const COLS = [
  { label: '행사', icon: 'fcb19', w: 'w-[260px]' },
  { label: '날짜(범위)', icon: '7db78', w: 'w-[180px]' },
  { label: '담당자', icon: '15302', w: 'w-[170px]' },
] as const;

const ROWS: { name: string; event: string; date: string; owner: string; status: StatusKey }[] = [];

export default function ScheduleTablePage() {
  return (
    <AppShell active="calendar">
      <div className="relative flex min-h-[900px] flex-col leading-[normal]">
        <Topbar />
        <ViewTabs tabs={SCHEDULE_TABS} active={0} bordered />
        <div className="flex flex-1 flex-col bg-surface">
          <div className="flex h-[36px] w-full shrink-0 items-start border-b border-solid border-border bg-surface text-xs font-medium text-fg-secondary">
            <div className="flex h-full w-[300px] items-center px-[16px]">일정명</div>
            {COLS.slice(0, 3).map((c) => (
              <div key={c.label} className={`flex h-full items-center gap-[6px] px-[16px] ${c.w}`}>
                <img alt="" src={`${A}/${c.icon}.svg`} className="size-[13px]" />
                <span className="whitespace-nowrap">{c.label}</span>
              </div>
            ))}
            <div className="flex h-full min-w-px flex-1 items-center gap-[6px] px-[16px]">
              <img alt="" src={`${A}/f8a2c.svg`} className="size-[13px]" />
              <span className="whitespace-nowrap">상태</span>
            </div>
            <div className="flex h-full w-[36px] items-center justify-center">
              <img alt="" src={`${A}/204e7.svg`} className="size-[14px]" />
            </div>
          </div>
          {ROWS.map((r, i) => (
            <div key={i} className="flex h-[44px] w-full shrink-0 items-start border-b border-solid border-border-soft text-base hover:bg-surface-sunken">
              <div className="flex h-full w-[300px] items-center px-[16px] font-medium text-fg">
                <span className="whitespace-nowrap">{r.name}</span>
              </div>
              <div className="flex h-full w-[260px] items-center px-[16px] text-fg">
                <span className="whitespace-nowrap">{r.event}</span>
              </div>
              <div className="flex h-full w-[180px] items-center px-[16px] text-fg-secondary">
                <span className="whitespace-nowrap">{r.date}</span>
              </div>
              <div className="flex h-full w-[170px] items-center px-[16px] text-fg">
                <span className="whitespace-nowrap">{r.owner}</span>
              </div>
              <div className="flex h-full min-w-px flex-1 items-center px-[16px]">
                <StatusPill status={r.status} />
              </div>
              <div className="h-full w-[36px] shrink-0" />
            </div>
          ))}
          <button type="button" className="flex h-[36px] w-full shrink-0 items-center text-left hover:bg-surface-sunken">
            <span className="flex h-full w-[300px] items-center gap-[6px] px-[16px] text-base text-fg-tertiary">
              <img alt="" src={`${A}/204e7.svg`} className="size-[14px]" />
              <span className="whitespace-nowrap">새 행</span>
            </span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
