const DAY_MS = 86_400_000;

/** 달력 날짜 기준 D-day 일수. 시작일이 지났으면 음수. */
export function daysUntil(start: Date, today: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((s - t) / DAY_MS);
}

export function dDayLabel(start: Date, today: Date): string {
  const diff = daysUntil(start, today);
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : '종료';
}
