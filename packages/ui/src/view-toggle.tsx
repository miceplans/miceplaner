import type { ReactNode } from 'react';

export type ViewToggleOption<T extends string> = { value: T; label: string; icon: string };

/** 갤러리/폴더 뷰 ↔ 리스트 전환 토글 (년도 별 보기 계열 화면 공용). */
export function ViewToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly ViewToggleOption<T>[];
  value: T;
  onChange?: (value: T) => void;
}): ReactNode {
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-[2px] rounded-md bg-surface-section p-[3px]" role="group">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange?.(o.value)}
            className={`flex h-[28px] items-center gap-[5px] rounded-sm px-[10px] text-base leading-[normal] ${
              on ? 'bg-surface font-semibold text-fg' : 'font-normal text-fg-disabled'
            }`}
          >
            <img alt="" src={o.icon} className="size-[14px]" />
            <span className="whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
