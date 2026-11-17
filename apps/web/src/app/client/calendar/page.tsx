import { ClientHeader } from '@miceplans/ui';

const A = '/assets/client/calendar-view';

type Tone = 'gray' | 'red' | 'blue' | 'yellow';
const TONE: Record<Tone, { bg: string; fg: string; dot: string }> = {
  gray: { bg: 'bg-surface-chip', fg: 'text-fg-secondary', dot: 'dot4' },
  red: { bg: 'bg-error-bg', fg: 'text-error-delay', dot: 'dot5' },
  blue: { bg: 'bg-info-bg', fg: 'text-brand-blue', dot: 'dot6' },
  yellow: { bg: 'bg-notice-bg', fg: 'text-notice', dot: 'dot7' },
};

const CHIPS: Record<number, readonly (readonly [string, Tone])[]> = {};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const LEGEND = [
  ['진행중', 'dot'],
  ['예정', 'dot1'],
  ['완료', 'dot2'],
  ['지연', 'dot3'],
] as const;

// 현재 월 기준 그리드. 빌드(프리렌더) 시점의 날짜로 정해진다.
const TODAY_DATE = new Date();
const YEAR = TODAY_DATE.getFullYear();
const MONTH = TODAY_DATE.getMonth() + 1;
const FIRST_WEEKDAY = new Date(YEAR, MONTH - 1, 1).getDay();
const DAYS = new Date(YEAR, MONTH, 0).getDate();
const TODAY = TODAY_DATE.getDate();

const cells: (number | null)[] = [
  ...Array<null>(FIRST_WEEKDAY).fill(null),
  ...Array.from({ length: DAYS }, (_, i) => i + 1),
];
while (cells.length % 7) cells.push(null);
const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

export default function ClientCalendarPage() {
  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface-sunken">
      <ClientHeader active="dashboard" />
      <main className="relative flex min-h-px flex-1 flex-col items-start bg-surface px-[32px]">
        <div className="flex h-[52px] w-full shrink-0 items-center px-[24px]">
          <div className="flex h-full items-start gap-[2px]">
            <a href="/client/events" className="flex h-full items-center gap-[7px] px-[12px]">
              <img alt="" src={`${A}/tab-icon.svg`} className="size-[15px]" />
              <span className="whitespace-nowrap text-base text-fg-secondary">행사 뷰</span>
            </a>
            <a href="/client/calendar" className="flex h-full items-center gap-[7px] px-[12px]">
              <img alt="" src={`${A}/tab-icon1.svg`} className="size-[15px]" />
              <span className="whitespace-nowrap text-base font-medium text-brand">캘린더 뷰</span>
            </a>
          </div>
        </div>
        <div className="flex h-[44px] w-full shrink-0 items-center gap-[10px] px-[24px]">
          <img alt="이전 달" src={`${A}/nav-icon.svg`} className="size-[15px]" />
          <p className="whitespace-nowrap text-lg font-semibold text-fg">{YEAR}년 {MONTH}월</p>
          <img alt="다음 달" src={`${A}/nav-icon1.svg`} className="size-[15px]" />
          <div className="h-px min-w-px flex-1" />
          <ul className="flex h-full items-center gap-[14px]">
            {LEGEND.map(([label, dot]) => (
              <li key={label} className="flex h-full items-center gap-[5px]">
                <img alt="" src={`${A}/${dot}.svg`} className="size-[7px]" />
                <span className="whitespace-nowrap text-xs text-fg-secondary">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-h-px w-full flex-1 flex-col items-start px-[24px] pb-[24px]">
          <div className="flex h-[32px] w-full shrink-0 items-start border-b border-solid border-border bg-surface">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`flex h-full items-center justify-center ${i === 6 ? 'w-[164.5px] shrink-0' : 'min-w-px flex-1'}`}
              >
                <p className="whitespace-nowrap text-xs font-medium text-fg-tertiary">{d}</p>
              </div>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div
              key={w}
              className={`flex h-[102px] w-full shrink-0 items-start border-solid border-border-strong ${w === weeks.length - 1 ? 'border' : 'border-b'}`}
            >
              {week.map((day, i) => {
                const chips = day ? (CHIPS[day] ?? []) : [];
                const last = i === 6;
                return (
                  <div
                    key={i}
                    className={`flex h-full flex-col items-start gap-[4px] border-solid border-border-soft px-[8px] pb-[6px] pt-[8px] ${
                      last ? 'w-[164.5px] shrink-0 border' : 'min-w-px flex-1 border-r'
                    } ${day ? 'bg-surface' : 'bg-surface-subtle'}`}
                  >
                    {day === TODAY ? (
                      <span className="flex shrink-0 items-center gap-[4px]">
                        <span className="flex size-[22px] items-center justify-center rounded-lg bg-brand text-xs font-semibold text-fg-inverse">
                          {day}
                        </span>
                        <span className="text-2xs font-medium text-fg-tertiary">({WEEKDAYS[i]})</span>
                      </span>
                    ) : day ? (
                      <p className="shrink-0 whitespace-nowrap text-sm text-fg-secondary">
                        {day} <span className="text-2xs text-fg-tertiary">({WEEKDAYS[i]})</span>
                      </p>
                    ) : null}
                    {chips.map(([label, tone]) => {
                      const t = TONE[tone];
                      return (
                        <div key={label} className={`flex h-[20px] shrink-0 items-center gap-[4px] rounded-xs px-[6px] ${t.bg}`}>
                          <img alt="" src={`${A}/${t.dot}.svg`} className="size-[5px] shrink-0" />
                          <p className={`whitespace-nowrap text-2xs font-medium ${t.fg}`}>{label}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
