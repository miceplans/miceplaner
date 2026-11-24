'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarRecentProvider, SidebarUserProvider } from '@miceplans/ui/sidebar';
import { ApiError, getToken } from '../lib/api';
import { useEventsList, useGetMe } from '../lib/api/generated/endpoints';
import { DesktopNotifications } from './desktop-notifications';

/**
 * 서버 상태 캐시. 요청을 줄이는 쪽으로 기본값을 잡는다:
 * 30초는 신선하게 보고, 창 포커스·재연결로는 다시 받지 않으며, 4xx(권한·없음)는 재시도하지 않는다.
 */
/** 로그인한 경우에만 내 정보를 조회해 사이드바 프로필에 전달한다. */
function SidebarUser({ children }: { children: ReactNode }) {
  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  return <SidebarUserProvider value={me.data ? { name: me.data.name, email: me.data.email, jobTitle: me.data.jobTitle, team: me.data.team, subTeam: me.data.subTeam, role: me.data.role } : null}>{children}</SidebarUserProvider>;
}

const RECENT_DOTS = ['dot-pink', 'dot-red'];

/** 사이드바 '최근' 목록에 오를 행사 수. */
const RECENT_COUNT = 5;

/** 시작일이 가장 가까운 행사부터 RECENT_COUNT개를 뽑아 사이드바 '최근'에 전달한다. */
function SidebarRecentEvents({ children }: { children: ReactNode }) {
  const events = useEventsList(undefined, { query: { enabled: getToken() !== null } });
  const recent = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    return (events.data ?? [])
      .filter((e) => e.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, RECENT_COUNT)
      .map((e, i) => ({
        name: e.name,
        dot: RECENT_DOTS[i % RECENT_DOTS.length]!,
        href: `/events/detail?id=${e.id}`,
        start: new Date(`${e.startDate}T00:00:00`),
      }));
  }, [events.data]);
  return <SidebarRecentProvider value={recent}>{children}</SidebarRecentProvider>;
}

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
  return <QueryClientProvider client={client}><DesktopNotifications /><SidebarUser><SidebarRecentEvents>{children}</SidebarRecentEvents></SidebarUser></QueryClientProvider>;
}
