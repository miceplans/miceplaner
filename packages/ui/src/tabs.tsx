import type { ReactNode } from 'react';

/**
 * 아이콘 없는 텍스트 탭 바. h44·border-b, 활성 탭은 brand 밑줄.
 * 아이콘 탭에는 schedule.tsx의 ViewTabs를 사용한다.
 */
export function TextTabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: readonly string[];
  active: string;
  onChange: (tab: string) => void;
  className?: string;
}): ReactNode {
  return (
    <div role="tablist" className={`flex h-[44px] w-full items-start border-b border-solid border-border-soft ${className}`}>
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={`flex h-full items-center px-[12px] text-base first:pl-0 ${
            active === t ? 'border-b-2 border-solid border-brand font-medium text-brand' : 'text-fg-secondary'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
