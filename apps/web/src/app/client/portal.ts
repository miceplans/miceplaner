import type { PortalEventDto, PortalProgramDto, PublicEventDto } from '@miceplans/contracts/portal';

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

/** UTC 자정 시각. Date.UTC의 월은 0부터라 1을 뺀다(안 빼면 달을 넘길 때 일수가 어긋난다). */
const utc = (iso: string): number => {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
};

/** 기준일까지 남은 일수 (오늘이면 0). */
export function daysUntil(iso: string, today: string): number {
  return Math.round((utc(iso) - utc(today)) / 86_400_000);
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

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Figma 목록 기간 표기: 하루면 04.18, 같은 해면 03.13 – 03.16, 해를 넘기면 연도까지 적는다. */
export function formatPeriod(start: string, end: string): string {
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end);
  if (sy !== ey) return `${formatDate(start)} – ${formatDate(end)}`;
  const from = `${pad2(sm)}.${pad2(sd)}`;
  return start === end ? from : `${from} – ${pad2(em)}.${pad2(ed)}`;
}

/** Figma 상세 기간 표기: 2025. 03. 13 – 03. 16. 하루면 시작일만, 해를 넘기면 양쪽에 연도를 적는다. */
export function formatPeriodLong(start: string, end: string): string {
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end);
  const from = `${sy}. ${pad2(sm)}. ${pad2(sd)}`;
  if (start === end) return from;
  const to = `${pad2(em)}. ${pad2(ed)}`;
  return `${from} – ${sy === ey ? to : `${ey}. ${to}`}`;
}

/** 대시보드 일정 날짜: 3/10 */
export const formatMonthDay = (iso: string): string => {
  const [, m, d] = parts(iso);
  return `${m}/${d}`;
};

/** 진행 단계에 보일 구간의 시작 위치. 현재(아직 끝나지 않은 첫) 단계와 그 직전 단계가 보이게 size개를 고른다. */
export function stepWindowStart(done: boolean[], size: number): number {
  const firstOpen = done.indexOf(false);
  const current = firstOpen === -1 ? done.length : firstOpen;
  return Math.max(0, Math.min(current - 1, done.length - size));
}

/** 게이지 조각별 채움(0 빈칸, 0.5 절반, 1 채움). */
export function gaugeFill(ratio: number, segments: number): (0 | 0.5 | 1)[] {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * segments * 2) / 2;
  return Array.from({ length: segments }, (_, i) => (filled >= i + 1 ? 1 : filled > i ? 0.5 : 0));
}

/** 기간의 총 일수 (양끝 포함). */
export function inclusiveDays(start: string, end: string): number {
  return Math.round((utc(end) - utc(start)) / 86_400_000) + 1;
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

/** 달력 막대에 쓰는 짧은 기간 표기: 하루면 11.18, 같은 해면 11.18 ~ 11.20, 해를 넘기면 연도까지 적는다. */
export function shortRange(start: string, end: string): string {
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end);
  const md = (m: number, d: number) => `${m}.${String(d).padStart(2, '0')}`;
  if (start === end) return md(sm, sd);
  if (sy === ey) return `${md(sm, sd)} ~ ${md(em, ed)}`;
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

/** 해당 월과 기간이 겹치는 공개 행사. 시작일 순, 같으면 긴 행사 먼저, 그다음 이름 순. */
export function eventsInMonth(events: PublicEventDto[], year: number, month: number): PublicEventDto[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStart = stamp(`${year}-${pad(month)}-01`);
  const monthEnd = stamp(`${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`);
  return events
    .filter((e) => stamp(e.endDate) >= monthStart && stamp(e.startDate) <= monthEnd)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate) || a.name.localeCompare(b.name, 'ko'));
}

/**
 * 주 행에 그릴 행사 기간 막대. col은 0(일)~6(토), span은 칸 수, lane은 겹치는 막대를 위아래로 나눈 줄 번호다.
 * continuesBefore·continuesAfter는 막대가 이 주(또는 이 달) 밖으로 이어지는지다.
 */
export type WeekBar = {
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  /** 행사에 지정된 대표색. 없으면 화면에서 행사 ID로 정한 기본색을 쓴다. */
  color: string | null;
  state: ScheduleState;
  col: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/** 공개 행사를 calendarWeeks의 주 행마다 이어진 기간 막대로 나눈다. 겹치면 빈 줄을 앞에서부터 채운다. */
export function eventWeekBars(events: PublicEventDto[], year: number, month: number, today: string): WeekBar[][] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayStamp = (d: number) => stamp(`${year}-${pad(month)}-${pad(d)}`);
  const sorted = eventsInMonth(events, year, month);
  return calendarWeeks(year, month).map((week) => {
    const days = week.filter((d): d is number => d !== null);
    const weekStart = dayStamp(days[0]!);
    const weekEnd = dayStamp(days[days.length - 1]!);
    const laneEnds: number[] = [];
    const bars: WeekBar[] = [];
    for (const e of sorted) {
      const s = stamp(e.startDate);
      const en = stamp(e.endDate);
      if (en < weekStart || s > weekEnd) continue;
      const col = week.indexOf(s < weekStart ? days[0]! : s % 100);
      const endCol = week.indexOf(en > weekEnd ? days[days.length - 1]! : en % 100);
      let lane = laneEnds.findIndex((end) => end < col);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = endCol;
      bars.push({
        eventId: e.eventId,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        color: e.color ?? null,
        state: eventState(e.startDate, e.endDate, today),
        col,
        span: endCol - col + 1,
        lane,
        continuesBefore: s < weekStart,
        continuesAfter: en > weekEnd,
      });
    }
    return bars;
  });
}
