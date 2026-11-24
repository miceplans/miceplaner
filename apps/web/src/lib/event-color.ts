export const EVENT_COLOR_PALETTE = ['#f567a5', '#4a8cff', '#2ebd85', '#ffaf20', '#8e6de8', '#31b8c6'] as const;

/** 새 행사는 팔레트에서 대표색을 무작위로 배정한다. */
export function randomEventColor(): string {
  return EVENT_COLOR_PALETTE[Math.floor(Math.random() * EVENT_COLOR_PALETTE.length)]!;
}

/** 색상이 없는 기존 행사는 ID에 따라 항상 같은 fallback 색상을 쓴다. */
export function eventColor(color: string | null | undefined, id: string): string {
  if (color) return color;
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return EVENT_COLOR_PALETTE[Math.abs(hash) % EVENT_COLOR_PALETTE.length]!;
}
