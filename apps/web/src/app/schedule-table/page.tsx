import { AppShell, SCHEDULE_TABS, StatusPill, Topbar, ViewTabs, type StatusKey } from '@miceplans/ui';

const A = '/assets/schedule';

const COLS = [
  { label: '행사', icon: 'fcb19', w: 'w-[260px]' },
  { label: '날짜(범위)', icon: '7db78', w: 'w-[180px]' },
  { label: '담당자', icon: '15302', w: 'w-[170px]' },
] as const;

const ROWS: { name: string; event: string; date: string; owner: string; status: StatusKey }[] = [
  { name: '홈페이지 오픈', event: '제54회 KIMES 2025', date: '02.24 – 02.26', owner: '박서연', status: '성공' },
  { name: '초청장 발송', event: '제54회 KIMES 2025', date: '03.03', owner: '최민준', status: '성공' },
  { name: '디자인 승인', event: '제54회 KIMES 2025', date: '03.05', owner: '박서연', status: '확인중' },
  { name: '브로슈어 인쇄', event: '제54회 KIMES 2025', date: '03.06 – 03.10', owner: '한지우', status: '만료' },
  { name: '리허설', event: '제54회 KIMES 2025', date: '03.12', owner: '최민준', status: '진행중' },
  { name: '홈페이지 오픈', event: '글로벌 AI 서밋 2025', date: '03.10 – 03.14', owner: '김도현', status: '제출' },
  { name: '초청장 발송', event: '삼성 파트너스 데이', date: '04.01 – 04.04', owner: '이준호', status: '제출' },
  { name: '행사 당일 운영', event: '제54회 KIMES 2025', date: '03.13 – 03.16', owner: '박서연', status: '진행중' },
];

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
