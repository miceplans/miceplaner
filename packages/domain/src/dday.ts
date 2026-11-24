const DAY_MS = 86_400_000;

/** 달력 날짜 기준 D-day 일수. 시작일이 지났으면 음수. */
export function daysUntil(start: Date, today: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((s - t) / DAY_MS);
}

/**
 * 시작 전은 D-n, 시작일은 D-Day, 시작일 이후 종료일까지는 진행, 종료일이 지나야 종료다.
 * 종료일을 모르면 시작일 하루짜리 행사로 본다.
 */
export function dDayLabel(start: Date, today: Date, end: Date = start): string {
  const diff = daysUntil(start, today);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return daysUntil(end, today) >= 0 ? '진행' : '종료';
}
