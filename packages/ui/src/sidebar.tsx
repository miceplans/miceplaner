import type { ReactNode } from 'react';

export type SidebarKey = 'events' | 'years' | 'calendar' | 'tasks' | 'clients' | 'notifications';

const A = '/assets/sidebar';

const NAV: { key: SidebarKey; label: string; icon: string; size: number; href: string; badge?: number }[] = [
  { key: 'events', label: '행사', icon: 'events', size: 16, href: '/' },
  { key: 'years', label: '년도 별 보기', icon: 'schedules', size: 16, href: '/events-by-year-2' },
  { key: 'calendar', label: '캘린더', icon: 'calendar', size: 16, href: '/schedule-calendar' },
  { key: 'tasks', label: '할 일', icon: 'tasks', size: 16, href: '/task-board' },
  { key: 'clients', label: '고객사', icon: 'clients', size: 17, href: '/client-list' },
  { key: 'notifications', label: '알림', icon: 'notifications', size: 16, href: '/notifications', badge: 3 },
];

const RECENT = [
  { name: 'BIPC', dot: 'dot-pink', avatars: [['bg-brand-amber', 'M'], ['bg-brand-pink', 'A']] },
  { name: '창업 AI 경진대회', dot: 'dot-red', avatars: [['bg-brand-blue', 'S'], ['bg-brand-green', 'J']] },
  { name: '청렴문화의날', dot: 'dot-red', avatars: [['bg-brand-blue', 'S'], ['bg-brand-green', 'J']] },
] as const;

export function Sidebar({ active, className = '' }: { active: SidebarKey; className?: string }): ReactNode {
  return (
    <aside className={`flex h-full w-[240px] shrink-0 flex-col overflow-hidden bg-surface-sidebar leading-[normal] max-md:h-auto max-md:w-full max-md:border-b max-md:border-border ${className}`} data-name="Sidebar">
      <div className="flex h-[52px] shrink-0 items-center pl-[12px] pr-[14px] max-md:hidden">
        <div className="flex items-center gap-[7px]">
          <img alt="MICE PLANER" src={`${A}/layer1.svg`} className="block h-[11.76px] w-[114px]" />
          <img alt="" src={`${A}/group5.svg`} className="block h-[26.758px] w-[21px]" />
        </div>
      </div>
      <nav className="flex flex-col gap-[2px] px-[10px] max-md:h-[52px] max-md:flex-row max-md:items-center max-md:gap-0 max-md:overflow-x-auto max-md:px-[8px]">
        {NAV.map((n) => (
          <a
            key={n.key}
            href={n.href}
            className={`flex h-[32px] items-center gap-[10px] rounded-sm px-[10px] text-base max-md:shrink-0 ${
              n.key === active ? 'bg-border font-semibold text-fg-strong' : 'text-fg'
            }`}
          >
            <img alt="" src={`${A}/${n.icon}.svg`} style={{ width: n.size, height: n.size }} />
            <span className="whitespace-nowrap">{n.label}</span>
            {n.badge ? (
              <>
                <span className="flex-1" />
                <span className="flex h-[18px] items-center justify-center rounded-md bg-brand px-[7px] text-2xs font-semibold text-fg-inverse">
                  {n.badge}
                </span>
              </>
            ) : null}
          </a>
        ))}
      </nav>
      <div className="min-h-[5px] flex-1 max-md:hidden" />
      <div className="flex shrink-0 flex-col gap-[4px] px-[10px] max-md:hidden">
        <p className="text-base font-bold text-fg-secondary">최근</p>
        <div className="flex flex-col">
          {RECENT.map((r) => (
            <div key={r.name} className="flex items-center h-[36px] gap-[11px] rounded-lg px-[10px]">
              <img alt="" src={`${A}/${r.dot}.svg`} className="size-[8px]" />
              <span className="whitespace-nowrap text-base font-medium text-fg-secondary">{r.name}</span>
              <span className="flex-1" />
              <span className="relative h-[16px] w-[34px]">
                {r.avatars.map(([c, t], i) => (
                  <span
                    key={t}
                    className={`absolute top-0 flex size-[16px] items-center justify-center rounded-md border-[1.5px] border-solid border-surface text-2xs font-bold text-fg-inverse ${c}`}
                    style={{ left: i * 10 }}
                  >
                    {t}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex h-[52px] shrink-0 items-center gap-[10px] border-t border-solid border-border px-[14px] max-md:hidden">
        <span className="flex size-[24px] items-center justify-center rounded-md bg-brand-tint text-2xs font-semibold text-brand">JY</span>
        <span className="whitespace-nowrap text-sm font-semibold text-fg">Jiyeong Hwang</span>
        <span className="flex-1" />
        <img alt="" src={`${A}/chevron.svg`} className="size-[13px]" />
      </div>
    </aside>
  );
}

export function AppShell({ active, children }: { active: SidebarKey; children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-screen w-full bg-surface max-md:flex-col">
      <div className="sticky top-0 h-screen min-h-[900px] shrink-0 self-start max-md:static max-md:h-auto max-md:min-h-0">
        <Sidebar active={active} />
      </div>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
