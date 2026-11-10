import { ClientHeader } from '@miceplans/ui';
import { EVENTS } from './data';

export default function ClientEventsPage() {
  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="flex min-h-px flex-1 flex-col items-center px-[32px]">
        <div className="flex w-full shrink-0 flex-col items-start py-[48px]">
          <div className="flex w-full flex-col items-start gap-[8px] whitespace-nowrap px-[4px] pb-[20px] leading-[normal]">
            <h1 className="text-2xl font-bold text-fg">행사 일정</h1>
            <p className="text-md text-fg-secondary">공유된 행사만 표시됩니다</p>
          </div>
          <ul className="flex h-[300px] w-full flex-col items-start rounded-xl border border-solid border-border bg-surface py-[6px]">
            {EVENTS.map((e) => (
              <li key={e.id} className="w-full">
                <a
                  href={`/client/events/${e.id}`}
                  className="flex h-[72px] w-full items-center gap-[16px] border-b border-solid border-border px-[20px]"
                >
                  <div className="flex h-full w-[48px] shrink-0 flex-col items-center whitespace-nowrap">
                    <p className="text-lg font-bold leading-[1.1] text-fg">{e.day}</p>
                    <p className="text-2xs text-fg-secondary">{e.month}</p>
                  </div>
                  <div className="flex h-full shrink-0 flex-col items-start gap-[3px] whitespace-nowrap leading-[normal]">
                    <p className="text-lg font-medium text-fg">{e.name}</p>
                    <p className="text-base text-fg-secondary">{e.meta}</p>
                  </div>
                  <div className="h-px min-w-px flex-1" />
                  <span className="flex h-[24px] shrink-0 items-center justify-center rounded-xl bg-surface-chip px-[9px] text-xs font-medium text-fg-secondary">
                    {e.dday}
                  </span>
                  <img alt="" src="/assets/client/calendar/row-chevron.svg" className="size-[16px] shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
