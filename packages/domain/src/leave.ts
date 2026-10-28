/** 명세 F-12: 휴가 형태와 차감 일수. 화면의 LEAVE_KINDS와 같다. */
export const LEAVE_KINDS = ['full', 'comp', 'am-half', 'pm-half', 'am-quarter', 'pm-quarter'] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];

export const LEAVE_KIND_DAYS: Record<LeaveKind, number> = { full: 1, comp: 1, 'am-half': 0.5, 'pm-half': 0.5, 'am-quarter': 0.25, 'pm-quarter': 0.25 };

export const leaveDays = (kind: LeaveKind): number => LEAVE_KIND_DAYS[kind];

/** 토·일이면 true. date는 YYYY-MM-DD이며 시간대와 무관하게 달력 날짜로 판정한다. */
export function isWeekend(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

/** 시작일~종료일 사이 평일 달력 날짜(YYYY-MM-DD) 목록. 기간 연차를 평일마다 한 건씩 신청하는 데 쓴다 (명세 F-12). */
export function weekdaysBetween(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const day = new Date(Date.UTC(sy!, sm! - 1, sd!));
  while (true) {
    const iso = day.toISOString().slice(0, 10);
    if (iso > endDate) break;
    if (!isWeekend(iso)) out.push(iso);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
}

export type LeaveUse = { kind: LeaveKind };

/** 대휴가 아닌 휴가의 사용 일수 합. */
export const annualUsed = (uses: readonly LeaveUse[]): number => uses.filter((u) => u.kind !== 'comp').reduce((s, u) => s + leaveDays(u.kind), 0);

/** 대휴 사용 일수 합. */
export const compUsed = (uses: readonly LeaveUse[]): number => uses.filter((u) => u.kind === 'comp').reduce((s, u) => s + leaveDays(u.kind), 0);
