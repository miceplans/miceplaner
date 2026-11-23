'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getToken } from '../../lib/api';

/** 로그인 없이 열리는 Client 포털 경로. */
const OPEN = new Set(['/client/login', '/client/apply']);

/**
 * 포털 화면은 Client 세션 토큰이 있어야 보인다. 토큰이 없으면 로그인으로 보낸다.
 * 토큰의 유효성·Client 역할은 API가 요청마다 확인하므로(401·403) 이 검사는 안내용이다.
 */
export function ClientGate({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, '');
  const [ready, setReady] = useState(OPEN.has(pathname));

  useEffect(() => {
    if (OPEN.has(pathname)) return setReady(true);
    if (getToken()) return setReady(true);
    window.location.replace('/client/login');
  }, [pathname]);

  return ready ? <>{children}</> : null;
}
