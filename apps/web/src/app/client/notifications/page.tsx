import { ClientFab, ClientHeader } from '@miceplans/ui';
import { CHIP, GROUPS } from './data';

const A = '/assets/client/inbox';

export default function ClientNotificationsPage() {
  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface">
      <ClientHeader active="dashboard" />
      <main className="relative flex min-h-px flex-1 flex-col items-start bg-surface-sunken p-[40px]">
        <div className="flex min-h-px w-full flex-1 flex-col items-start gap-[14px]">
          {GROUPS.map((g) => (
            <section key={g.label} className="flex w-full shrink-0 flex-col items-start gap-[8px]">
              <div className="flex w-full items-center gap-[8px]">
                <h2 className="whitespace-nowrap text-base font-semibold text-fg">{g.label}</h2>
                {g.badge ? (
                  <span className="flex h-[18px] items-center justify-center rounded-md bg-ai-tint px-[7px] text-2xs font-medium text-ai">
                    {g.badge}
                  </span>
                ) : null}
              </div>
              <ul className={`flex w-full flex-col items-start rounded-lg border border-solid border-border bg-surface ${g.height}`}>
                {g.rows.map((r, i) => (
                  <li key={r.id} className="w-full">
                    <a
                      href={`/client/notifications/${r.id}`}
                      className={`flex w-full items-center gap-[12px] border-solid border-border px-[16px] py-[11px] ${
                        i < g.rows.length - 1 ? 'h-[58px] border-b' : ''
                      }`}
                    >
                      <div className={`flex size-[34px] shrink-0 items-center justify-center rounded-md ${CHIP[r.tone]}`}>
                        <img alt="" src={`${A}/${r.icon}.svg`} className="size-[16px]" />
                      </div>
                      <div className="flex h-full min-w-px flex-1 flex-col items-start gap-[4px]">
                        <p className={`w-full text-base leading-[1.4] ${r.unread ? 'font-semibold text-fg' : 'text-fg-secondary'}`}>
                          {r.title}
                        </p>
                        <div className="flex items-center gap-[7px] whitespace-nowrap text-xs leading-[normal]">
                          <span className="text-fg-secondary">{r.event}</span>
                          <span className="text-fg-tertiary">·</span>
                          <span className="text-fg-tertiary">{r.when}</span>
                        </div>
                      </div>
                      <div className="h-px w-[2px] shrink-0" />
                      {r.unread ? (
                        <img alt="안 읽음" src={`${A}/unread.svg`} className="size-[7px] shrink-0" />
                      ) : (
                        <div className="h-px w-[7px] shrink-0" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="w-full whitespace-nowrap text-center text-xs leading-[normal] text-fg-tertiary">
            30일이 지난 알림은 자동으로 정리돼요
          </p>
        </div>
        <ClientFab color="var(--color-ai-strong)" icon={`${A}/sparkles.svg`} />
      </main>
    </div>
  );
}
