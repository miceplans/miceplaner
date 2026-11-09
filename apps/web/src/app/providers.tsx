'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { DesktopNotifications } from './desktop-notifications';

/**
 * 서버 상태 캐시. 요청을 줄이는 쪽으로 기본값을 잡는다:
 * 30초는 신선하게 보고, 창 포커스·재연결로는 다시 받지 않으며, 4xx(권한·없음)는 재시도하지 않는다.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}><DesktopNotifications />{children}</QueryClientProvider>;
}
