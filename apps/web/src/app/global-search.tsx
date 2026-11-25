'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { SearchOpenProvider } from '@miceplans/ui';
import { isPublicPath } from './auth-guard';

// 검색 창은 열 때만 받는다. 모든 페이지 번들에 들어가지 않게 한다.
const SearchDialog = dynamic(() => import('./search-dialog').then((module) => module.SearchDialog), { ssr: false });

/** 상단바 검색 버튼과 ⌘K(Ctrl+K)로 여는 통합 검색. 로그인 화면과 Client 포털에서는 열리지 않는다. */
export function GlobalSearch({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const disabled = isPublicPath(usePathname());
  const show = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      // 한글 자판에서도 동작하도록 글자 대신 키 위치로 판정한다.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === 'KeyK') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  return (
    <SearchOpenProvider value={disabled ? null : show}>
      {children}
      {open && !disabled && <SearchDialog onClose={() => setOpen(false)} />}
    </SearchOpenProvider>
  );
}
