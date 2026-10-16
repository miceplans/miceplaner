import type { ReactNode } from 'react';

/** 숫자 뱃지(알림 카운트). Figma 표준: h18·px 7·rounded-full, bg brand. */
export function Badge({ count }: { count: number }): ReactNode {
  return (
    <span className="flex h-[18px] items-center justify-center rounded-full bg-brand px-[7px] text-2xs font-semibold text-fg-inverse">
      {count}
    </span>
  );
}
