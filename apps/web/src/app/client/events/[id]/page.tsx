import { EVENTS } from '../data';

const A = '/assets/client/event-detail';

export const dynamicParams = false;

export function generateStaticParams() {
  // output: export는 동적 경로에 최소 1개 값이 필요하다. 행사 데이터가 없으면 자리표시 경로 하나만 만든다.
  return [...EVENTS.map((e) => e.id), '_'].map((id) => ({ id }));
}

const INFO: { label: string; icon: string; main: string; sub: string }[] = [];

export default function ClientEventDetailPage() {
  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <header className="flex h-[64px] w-full shrink-0 items-center gap-[10px] border-b border-solid border-border bg-surface px-[32px]">
        <div className="flex size-[26px] shrink-0 items-center justify-center rounded-sm bg-fg">
          <p className="text-base font-semibold text-fg-inverse">M</p>
        </div>
        <p className="whitespace-nowrap text-md font-semibold tracking-[0.3px] text-fg">MICEPLANNER</p>
        <div className="h-[16px] w-px shrink-0 bg-border-strong" />
        <p className="whitespace-nowrap text-sm text-fg-secondary">고객 포털</p>
        <div className="h-px min-w-px flex-1" />
        <p className="whitespace-nowrap text-base text-fg">고객사</p>
        <div className="flex size-[28px] shrink-0 items-center justify-center rounded-xl bg-ai-tint">
          <p className="text-2xs font-semibold text-ai">고</p>
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
              <p className="whitespace-nowrap text-sm font-medium text-ai"></p>
            </div>
            <h1 className="w-full text-2xl font-bold leading-[1.3] text-fg">행사</h1>
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
          </section>
        </div>
      </main>
    </div>
  );
}
