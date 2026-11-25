'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** 통합 검색 창을 여는 함수. 앱이 Provider로 주입하며, 없으면 상단바의 검색 버튼을 숨긴다. */
const SearchOpenContext = createContext<(() => void) | null>(null);
export const SearchOpenProvider = SearchOpenContext.Provider;

/** 상단바의 검색 버튼. 입력은 앱이 여는 검색 창에서 받는다. */
export function TopbarSearch({ showKbd = true, className = '' }: { showKbd?: boolean; className?: string }): ReactNode {
  const open = useContext(SearchOpenContext);
  if (!open) return null;
  return (
    <button
      type="button"
      aria-label="검색 열기"
      aria-haspopup="dialog"
      onClick={open}
      className={`flex h-[32px] w-[280px] shrink-0 items-center gap-[8px] rounded-sm bg-surface-chip px-[10px] text-left ${className}`}
    >
      <img alt="" src="/assets/flow/search-icon.svg" className="size-[15px] shrink-0" />
      <span className="min-w-0 flex-1 text-base text-fg-tertiary">검색</span>
      {showKbd ? (
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface px-[5px] text-2xs text-fg-secondary">⌘K</span>
      ) : null}
    </button>
  );
}
