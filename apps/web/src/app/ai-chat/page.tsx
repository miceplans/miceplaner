import { AppShell } from '@miceplans/ui';
import { AiChatPanel } from './ai-chat-panel';

const A = '/assets/ai-chat';

type Status = '진행중' | '성공' | '확인중' | '만료' | '제출';

const PILL: Record<Status, { bg: string; fg: string; icon: string; w: number; h: number }> = {
  진행중: { bg: 'bg-info-bg', fg: 'text-info', icon: 'ellipse24', w: 12, h: 12 },
  성공: { bg: 'bg-success-bg', fg: 'text-success', icon: 'vector', w: 14.333, h: 14.333 },
  확인중: { bg: 'bg-warning-bg', fg: 'text-warning', icon: 'vector1', w: 12, h: 11.828 },
  만료: { bg: 'bg-expired-bg', fg: 'text-expired', icon: 'vector2', w: 14, h: 14 },
  제출: { bg: 'bg-submit-bg', fg: 'text-submit', icon: 'vector3', w: 12.5, h: 12 },
};

function StatusPill({ status }: { status: Status }) {
  const p = PILL[status];
  return (
    <div className={`flex items-center gap-[4px] rounded-sm px-[8px] py-[5px] ${p.bg} ${status === '성공' || status === '제출' ? 'h-[24px]' : ''}`}>
      <span className="flex shrink-0 items-center justify-center" style={{ width: p.w, height: p.h }}>
        {status === '제출' ? (
          <img alt="" src={`${A}/${p.icon}.svg`} className="block rotate-[25deg]" />
        ) : (
          <img alt="" src={`${A}/${p.icon}.svg`} className="block size-full max-w-none" />
        )}
      </span>
      <span className={`whitespace-nowrap text-xs font-bold ${p.fg}`}>{status}</span>
    </div>
  );
}

const ROWS: { name: string; period: string; client: string; pm: string; am: string; status: Status; place: string }[] = [
  { name: '제54회 KIMES 2025', period: '03.13 – 03.16', client: '메디코리아', pm: '박서연', am: '최민준', status: '진행중', place: '코엑스 Hall A·B' },
  { name: '글로벌 AI 서밋 2025', period: '04.02 – 04.03', client: '테크노웨이', pm: '김도현', am: '한지우', status: '성공', place: '인터컨티넨탈 파르나스' },
  { name: '삼성 파트너스 데이', period: '04.18', client: '삼성전자', pm: '박서연', am: '이준호', status: '진행중', place: '코엑스 오디토리움' },
  { name: '제12회 프랜차이즈 엑스포', period: '05.08 – 05.10', client: '프랜차이즈협회', pm: '정유나', am: '최민준', status: '제출', place: '일산 킨텍스 Hall 1' },
  { name: '현대자동차 신차 발표회', period: '05.22', client: '현대자동차', pm: '김도현', am: '한지우', status: '확인중', place: '잠실 롯데월드타워' },
  { name: '서울 ESG 포럼 2025', period: '06.05 – 06.06', client: '그린퓨처', pm: '정유나', am: '이준호', status: '만료', place: '포시즌스 호텔 서울' },
  { name: '로진컴퍼니 킥오프 미팅', period: '07.11 – 07.12', client: '로진컴퍼니', pm: '박서연', am: '최민준', status: '성공', place: '제주 신화월드' },
];

const COLS: { label: string; icon?: string; w: string }[] = [
  { label: '행사명', w: 'w-[330px]' },
  { label: '기간', icon: 'col-icon', w: 'w-[140px]' },
  { label: 'Client', icon: 'col-icon1', w: 'w-[130px]' },
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
              <span className="whitespace-nowrap text-base text-fg-secondary">Workspace</span>
              <img alt="" src={`${A}/crumb-chevron.svg`} className="size-[13px]" />
              <span className="whitespace-nowrap text-base font-semibold text-fg">행사s</span>
            </div>
            <div className="flex-1" />
            <div className="flex h-[32px] w-[280px] items-center gap-[8px] rounded-sm bg-surface-chip px-[10px]">
              <img alt="" src={`${A}/search-icon.svg`} className="size-[15px]" />
              <span className="whitespace-nowrap text-base text-fg-tertiary">Search</span>
              <div className="flex-1" />
              <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface px-[5px] text-2xs text-fg-secondary">⌘K</span>
            </div>
            <button type="button" className="flex h-[30px] items-center gap-[6px] rounded-sm bg-brand px-[12px]">
              <img alt="" src={`${A}/plus-icon.svg`} className="size-[14px]" />
              <span className="whitespace-nowrap text-base font-semibold text-fg-inverse">New 행사</span>
            </button>
            <span className="flex size-[26px] items-center justify-center rounded-xl bg-brand-tint text-2xs font-semibold text-brand">JY</span>
          </div>
          <div className="flex h-[52px] shrink-0 items-center border-b border-solid border-border px-[24px]">
            <div className="flex h-full gap-[2px]">
              {[
                { t: '전체 행사', i: 'tab-icon', on: true },
                { t: '내 행사', i: 'tab-icon1' },
                { t: 'Calendar', i: 'tab-icon2' },
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
      <AiChatPanel />
    </div>
  );
}
