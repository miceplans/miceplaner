import type { ReactNode } from 'react';

export type SegmentOption<T extends string> = { value: T; label: string };

/**
 * 캘린더 보기(Day/Week/Month) 전환 세그먼트.
 * md: p3 컨테이너·2xs 라벨(대시보드), sm: p4 컨테이너·xs 라벨(행사 상세 툴 바).
 */
export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'sm';
}): ReactNode {
  const container =
    size === 'md'
      ? 'flex items-center gap-[2px] self-stretch rounded-full bg-surface-muted p-[3px]'
      : 'flex items-center rounded-full bg-surface-chip p-[4px]';
  const item =
    size === 'md'
      ? 'flex h-full items-center justify-center rounded-full px-[13px] py-[6px] text-2xs'
      : 'h-[24px] rounded-full px-[12px] text-xs';
  const onCls =
    size === 'md' ? 'bg-surface font-bold text-fg shadow-segment' : 'bg-surface font-semibold text-fg shadow-segment';
  return (
    <div className={container} role="group">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`${item} ${on ? onCls : size === 'md' ? 'font-semibold text-fg-secondary' : 'text-fg-secondary'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
