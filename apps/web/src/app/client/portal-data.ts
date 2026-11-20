import type { PortalEventDto, PortalProgramDto } from '@miceplans/contracts/portal';

const MS_PER_DAY = 86_400_000;
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY);
const todayIso = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** 오늘부터 날짜까지 남은 일수. 지난 날짜는 음수다. */
export const daysUntil = (iso: string, now = new Date()): number => dayNumber(iso) - dayNumber(todayIso(now));

/** `D-3`, `D-DAY`, `D+2` 형식. */
export const ddayLabel = (iso: string, now = new Date()): string => {
  const days = daysUntil(iso, now);
  return days === 0 ? 'D-DAY' : days > 0 ? `D-${days}` : `D+${-days}`;
};

/** 행사 목록 한 줄에 쓰는 날짜 조각. */
export const eventDayParts = (event: PortalEventDto) => {
  const [, month = '', day = ''] = event.startDate.split('-');
  return { day: String(Number(day)), month: `${Number(month)}월` };
};

/** 종료일이 지나지 않은 행사를 가까운 시작일 순으로 앞에 둔다. */
export const sortEvents = (events: PortalEventDto[], now = new Date()): PortalEventDto[] =>
  [...events].sort((a, b) => {
    const aPast = daysUntil(a.endDate, now) < 0;
    const bPast = daysUntil(b.endDate, now) < 0;
    return aPast === bPast ? (aPast ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate)) : aPast ? 1 : -1;
  });

/** 마감(없으면 시작) 기준으로 오늘 이후의 공개 Program을 가까운 순으로 돌려준다. */
export const upcomingPrograms = (programs: PortalProgramDto[], now = new Date()) =>
  programs
    .map((program) => ({ program, on: program.dueOn ?? program.startsOn }))
    .filter((entry): entry is { program: PortalProgramDto; on: string } => entry.on !== null && daysUntil(entry.on, now) >= 0)
    .sort((a, b) => a.on.localeCompare(b.on));
