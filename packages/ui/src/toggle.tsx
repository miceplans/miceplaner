import type { ReactNode } from 'react';

/** 토글 스위치. 트랙 h20·w34·rounded-full, 손잡이 16px. */
export function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-border-placeholder'}`}
    >
      <span
        className={`absolute top-[2px] size-[16px] rounded-full bg-surface transition-all ${checked ? 'left-[16px]' : 'left-[2px]'}`}
      />
    </button>
  );
}
