import type { PortalEventDto, PortalProgramDto } from '@miceplans/contracts/portal';

/** Client 포털 화면이 쓰는 날짜·상태 도출 로직. 입력 날짜는 모두 YYYY-MM-DD 문자열이다. */

export type ScheduleState = '예정' | '진행중' | '완료';

const parts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
};

/** YYYY-MM-DD를 정수로 바꿔 비교한다 (시간대 영향 없음). */
const stamp = (iso: string): number => {
  const [y, m, d] = parts(iso);
  return y * 10000 + m * 100 + d;
};

/** 로컬 오늘 날짜를 YYYY-MM-DD로 돌려준다. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 행사 기간 대비 오늘의 상태. */
export function eventState(startDate: string, endDate: string, today: string): ScheduleState {
  const t = stamp(today);
  if (t > stamp(endDate)) return '완료';
  if (t < stamp(startDate)) return '예정';
  return '진행중';
}

/** Program 일정 대비 오늘의 상태. 시작일·마감일이 모두 비어 있으면 null이다. */
export function programState(startsOn: string | null, dueOn: string | null, today: string): ScheduleState | null {
  if (!startsOn && !dueOn) return null;
  const t = stamp(today);
  const start = startsOn ?? dueOn;
  const end = dueOn ?? startsOn;
  if (t > stamp(end!)) return '완료';
  if (t < stamp(start!)) return '예정';
  return '진행중';
}

/** 기준일까지 남은 일수 (오늘이면 0). */
export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.UTC(...parts(iso)) - Date.UTC(...parts(today))) / 86_400_000);
}

/** 행사 목록의 D-day 칩 문구. */
export function ddayLabel(startDate: string, endDate: string, today: string): string {
  const state = eventState(startDate, endDate, today);
  if (state === '완료') return '완료';
  if (state === '진행중') return '진행중';
  return `D-${daysUntil(startDate, today)}`;
}

export const formatDay = (iso: string): string => String(parts(iso)[2]);

export const formatMonth = (iso: string): string => `${parts(iso)[1]}월`;

export const formatDate = (iso: string): string => {
  const [y, m, d] = parts(iso);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
};

/** 같은 해이면 연도를 한 번만 적는다: 2026.11.18 ~ 11.20 */
export function formatRange(start: string, end: string): string {
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end);
  if (sy === ey) {
    return sm === em
      ? `${sy}.${String(sm).padStart(2, '0')}.${String(sd).padStart(2, '0')} ~ ${String(ed).padStart(2, '0')}`
      : `${sy}.${String(sm).padStart(2, '0')}.${String(sd).padStart(2, '0')} ~ ${String(em).padStart(2, '0')}.${String(ed).padStart(2, '0')}`;
  }
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

/** 기간의 총 일수 (양끝 포함). */
export function inclusiveDays(start: string, end: string): number {
  return Math.round((Date.UTC(...parts(end)) - Date.UTC(...parts(start))) / 86_400_000) + 1;
}

/** 시작일 오름차순, 같은 날이면 제목 순. */
export function sortPrograms(programs: PortalProgramDto[]): PortalProgramDto[] {
  return [...programs].sort((a, b) => {
    const byStart = (a.startsOn ?? a.dueOn ?? '').localeCompare(b.startsOn ?? b.dueOn ?? '');
    return byStart !== 0 ? byStart : a.title.localeCompare(b.title, 'ko');
  });
}

/** 가장 임박한 행사: 진행중을 먼저, 없으면 시작일이 가장 가까운 예정 행사. */
export function nearestEvent(events: PortalEventDto[], today: string): PortalEventDto | null {
  const ongoing = events.filter((e) => eventState(e.startDate, e.endDate, today) === '진행중');
  const pool = ongoing.length > 0 ? ongoing : events.filter((e) => eventState(e.startDate, e.endDate, today) === '예정');
  if (pool.length === 0) return null;
  return pool.reduce((a, b) => (stamp(a.startDate) <= stamp(b.startDate) ? a : b));
}

/** 달력 그리드. 앞뒤 빈 칸은 null이다. */
export function calendarWeeks(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export type DayChip = { programId: string; title: string; state: ScheduleState };

/** Program 일정을 달력 칸별 칩으로 나눈다. 시작일~마감일 사이 모든 날에 표시하고, 범위가 해당 월과 겹치는 부분만 돌려준다. */
export function chipsByDay(programs: PortalProgramDto[], year: number, month: number, today: string): Map<number, DayChip[]> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStart = stamp(`${year}-${pad(month)}-01`);
  const monthEnd = stamp(`${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`);
  const byDay = new Map<number, DayChip[]>();

  for (const p of programs) {
    const start = p.startsOn ?? p.dueOn;
    const end = p.dueOn ?? p.startsOn;
    if (!start || !end) continue;
    const from = Math.max(stamp(start), monthStart);
    const to = Math.min(stamp(end), monthEnd);
    for (let s = from; s <= to; s++) {
      if (s < monthStart || s > monthEnd) continue;
      const day = s % 100;
      const list = byDay.get(day) ?? [];
      const state = programState(start, end, today) ?? '예정';
      if (!list.some((c) => c.programId === p.programId)) list.push({ programId: p.programId, title: p.title, state });
      byDay.set(day, list);
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  }
  return byDay;
}
