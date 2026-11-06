'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getToken } from '../lib/api';

/** 로그인 없이 접근할 수 있는 경로다. Client 포털은 별도 링크로 공유된다. */
export const isPublicPath = (pathname: string): boolean =>
  pathname === '/login' || pathname === '/client' || pathname.startsWith('/client/');

/** 토큰이 없는 상태로 내부 페이지에 들어오면 로그인 페이지로 보낸다. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isPublicPath(pathname) && !getToken()) window.location.replace('/login');
  }, [pathname]);

  return <>{children}</>;
}
