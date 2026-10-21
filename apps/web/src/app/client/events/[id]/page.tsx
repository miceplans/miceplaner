import { EVENTS } from '../data';

const A = '/assets/client/event-detail';

export const dynamicParams = false;

export function generateStaticParams() {
  return EVENTS.map((e) => ({ id: e.id }));
}

const INFO = [
  { label: '기간', icon: 'info', main: '2025. 03. 13 – 03. 16', sub: '4일간 진행' },
  { label: '장소', icon: 'info1', main: '코엑스 Hall A·B', sub: '서울시 강남구 영동대로 513' },
  { label: '담당자', icon: 'info2', main: '박서연 (PM)', sub: '010-7542-8891' },
  { label: '이메일', icon: 'info3', main: 'seoyeon.park@miceplans.co.kr', sub: '평일 09:00 – 18:00 응답' },
];

export default function ClientEventDetailPage() {
  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <header className="flex h-[64px] w-full shrink-0 items-center gap-[10px] border-b border-solid border-border bg-surface px-[32px]">
        <div className="flex size-[26px] shrink-0 items-center justify-center rounded-sm bg-fg">
          <p className="text-base font-semibold text-fg-inverse">M</p>
        </div>
        <p className="whitespace-nowrap text-md font-semibold tracking-[0.3px] text-fg">mice planner</p>
        <div className="h-[16px] w-px shrink-0 bg-border-strong" />
        <p className="whitespace-nowrap text-sm text-fg-secondary">Client Portal</p>
        <div className="h-px min-w-px flex-1" />
        <p className="whitespace-nowrap text-base text-fg">메디코리아</p>
        <div className="flex size-[28px] shrink-0 items-center justify-center rounded-xl bg-ai-tint">
          <p className="text-2xs font-semibold text-ai">메</p>
        </div>
      </header>
      <main className="flex min-h-px flex-1 flex-col items-center">
        <div className="flex w-[640px] shrink-0 flex-col items-start py-[40px]">
          <a href="/client/events" className="flex h-[32px] shrink-0 items-center gap-[6px] px-[4px]">
            <img alt="" src={`${A}/back.svg`} className="size-[15px]" />
            <span className="whitespace-nowrap text-base text-fg-secondary">행사 일정</span>
          </a>
          <section className="flex h-[444px] w-full shrink-0 flex-col items-start rounded-xl border border-solid border-border bg-surface p-[28px]">
            <div className="flex h-[26px] shrink-0 items-center justify-center rounded-xl bg-ai-tint px-[11px]">
              <p className="whitespace-nowrap text-sm font-medium text-ai">3월 13일 – 16일</p>
            </div>
            <h1 className="w-full text-2xl font-bold leading-[1.3] text-fg">제54회 KIMES 2025</h1>
            <div className="h-px w-full shrink-0 bg-border-strong" />
            <ul className="flex w-full flex-col items-start">
              {INFO.map((r) => (
                <li
                  key={r.label}
                  className="flex h-[56px] w-full items-center gap-[14px] border-b border-solid border-border"
                >
                  <img alt="" src={`${A}/${r.icon}.svg`} className="size-[16px] shrink-0" />
                  <p className="h-[18px] w-[64px] shrink-0 text-base text-fg-secondary">{r.label}</p>
                  <div className="flex h-full shrink-0 flex-col items-start gap-px whitespace-nowrap leading-[normal]">
                    <p className="text-md text-fg">{r.main}</p>
                    <p className="text-xs text-fg-secondary">{r.sub}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex w-full shrink-0 flex-col items-start gap-[14px] py-[20px]">
              <a
                href="mailto:seoyeon.park@miceplans.co.kr"
                className="flex h-[38px] shrink-0 items-center gap-[8px] rounded-md bg-brand-soft px-[16px]"
              >
                <img alt="" src={`${A}/mail.svg`} className="size-[15px]" />
                <span className="whitespace-nowrap text-md font-medium text-fg-inverse">담당자에게 문의</span>
              </a>
              <p className="w-full text-xs leading-[normal] text-fg-tertiary">
                행사 관련 자료 요청은 담당자 메일로 보내주시면 1영업일 내 회신됩니다
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
