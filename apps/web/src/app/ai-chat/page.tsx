import { StatusPill } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';

const A = '/assets/ai-chat';

type Status = '진행중' | '성공' | '확인중' | '만료' | '제출';

const ROWS: { name: string; period: string; client: string; pm: string; am: string; status: Status; place: string }[] = [];

const COLS: { label: string; icon?: string; w: string }[] = [
  { label: '행사명', w: 'w-[330px]' },
  { label: '기간', icon: 'col-icon', w: 'w-[140px]' },
  { label: '고객사', icon: 'col-icon1', w: 'w-[130px]' },
  { label: 'PM', icon: 'col-icon2', w: 'w-[125px]' },
  { label: 'AM', icon: 'col-icon2', w: 'w-[125px]' },
  { label: '상태', icon: 'col-icon3', w: 'w-[110px]' },
];

function Person({ name }: { name: string }) {
  return (
    <div className="flex h-full w-[125px] shrink-0 items-center gap-[7px] px-[16px]">
      <span className="flex size-[20px] shrink-0 items-center justify-center rounded-lg bg-brand-tint text-2xs font-semibold text-brand">
        {name[0]}
      </span>
      <span className="whitespace-nowrap text-base text-fg">{name}</span>
    </div>
  );
}

export default function AiChatPage() {
  return (
    <div className="relative h-[900px] w-[1440px] overflow-hidden">
      <AppShell active="events">
        <div className="flex h-[900px] flex-col leading-[normal]">
          <div className="flex h-[56px] shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
            <div className="flex size-[28px] items-center justify-center rounded-sm">
              <img alt="" src={`${A}/toggle-icon.svg`} className="size-[16px]" />
            </div>
            <div className="flex h-full items-center gap-[6px]">
              <span className="whitespace-nowrap text-base text-fg-secondary">워크스페이스</span>
              <img alt="" src={`${A}/crumb-chevron.svg`} className="size-[13px]" />
              <span className="whitespace-nowrap text-base font-semibold text-fg">행사</span>
            </div>
            <div className="flex-1" />
            <div className="flex h-[32px] w-[280px] items-center gap-[8px] rounded-sm bg-surface-chip px-[10px]">
              <img alt="" src={`${A}/search-icon.svg`} className="size-[15px]" />
              <span className="whitespace-nowrap text-base text-fg-tertiary">검색</span>
              <div className="flex-1" />
              <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface px-[5px] text-2xs text-fg-secondary">⌘K</span>
            </div>
            <a href="/import/upload" className="flex h-[30px] items-center gap-[6px] rounded-sm bg-brand px-[12px]">
              <img alt="" src={`${A}/plus-icon.svg`} className="size-[14px]" />
              <span className="whitespace-nowrap text-base font-semibold text-fg-inverse">새 행사</span>
            </a>
            <span className="flex size-[26px] items-center justify-center rounded-xl bg-brand-tint text-2xs font-semibold text-brand">JY</span>
          </div>
          <div className="flex h-[52px] shrink-0 items-center border-b border-solid border-border px-[24px]">
            <div className="flex h-full gap-[2px]">
              {[
                { t: '전체 행사', i: 'tab-icon', on: true },
                { t: '내 행사', i: 'tab-icon1' },
                { t: '캘린더', i: 'tab-icon2' },
              ].map((x) => (
                <div
                  key={x.t}
                  className={`flex h-full items-center gap-[7px] px-[12px] ${x.on ? 'border-b-2 border-solid border-brand text-brand' : 'text-fg-secondary'}`}
                >
                  <img alt="" src={`${A}/${x.i}.svg`} className="size-[15px]" />
                  <span className={`whitespace-nowrap text-base ${x.on ? 'font-medium' : ''}`}>{x.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-1 flex-col bg-surface">
            <div className="flex h-[36px] shrink-0 border-b border-solid border-border">
              {COLS.map((c) => (
                <div key={c.label} className={`flex h-full shrink-0 items-center gap-[6px] px-[16px] ${c.w}`}>
                  {c.icon ? <img alt="" src={`${A}/${c.icon}.svg`} className="size-[13px]" /> : null}
                  <span className="whitespace-nowrap text-xs font-medium text-fg-secondary">{c.label}</span>
                </div>
              ))}
              <div className="flex h-full min-w-0 flex-1 items-center gap-[6px] px-[16px]">
                <img alt="" src={`${A}/col-icon4.svg`} className="size-[13px]" />
                <span className="whitespace-nowrap text-xs font-medium text-fg-secondary">장소</span>
              </div>
              <div className="flex h-full w-[36px] shrink-0 items-center justify-center">
                <img alt="" src={`${A}/plus-icon1.svg`} className="size-[14px]" />
              </div>
            </div>
            {ROWS.map((r) => (
              <div key={r.name} className="flex h-[44px] shrink-0 border-b border-solid border-border-soft">
                <div className="flex h-full w-[330px] shrink-0 items-center px-[16px]">
                  <span className="whitespace-nowrap text-base font-medium text-fg">{r.name}</span>
                </div>
                <div className="flex h-full w-[140px] shrink-0 items-center px-[16px]">
                  <span className="whitespace-nowrap text-base text-fg-secondary">{r.period}</span>
                </div>
                <div className="flex h-full w-[130px] shrink-0 items-center px-[16px]">
                  <span className="whitespace-nowrap text-base text-fg">{r.client}</span>
                </div>
                <Person name={r.pm} />
                <Person name={r.am} />
                <div className="flex h-full w-[110px] shrink-0 items-center px-[16px]">
                  <StatusPill status={r.status} />
                </div>
                <div className="flex h-full min-w-0 flex-1 items-center px-[16px]">
                  <span className="whitespace-nowrap text-base text-fg">{r.place}</span>
                </div>
                <div className="h-full w-[36px] shrink-0" />
              </div>
            ))}
            <div className="flex h-[36px] shrink-0 items-center">
              <div className="flex h-full w-[330px] items-center gap-[6px] px-[16px]">
                <img alt="" src={`${A}/plus-icon1.svg`} className="size-[14px]" />
                <span className="whitespace-nowrap text-base text-fg-tertiary">새 행</span>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </div>
  );
}
