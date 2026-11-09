'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/api';
import { useNotificationsList } from '@/lib/api/generated/endpoints';
import { DESKTOP_NOTIFICATION_CHANGE, desktopNotificationsEnabled, sendDesktopNotification } from '@/lib/desktop';

/**
 * 데스크톱에서 사용자가 명시적으로 허용한 경우에만 unread 알림을 OS 알림으로 전달한다.
 * 최초 조회는 기준점으로만 쓰므로, 앱을 열 때 과거 알림을 다시 전송하지 않는다.
 */
export function DesktopNotifications() {
  const [enabled, setEnabled] = useState(false);
  const seen = useRef<Set<number> | null>(null);
  const live = Boolean(getToken()) && enabled;
  const notifications = useNotificationsList(
    { unread: true, limit: 20 },
    { query: { enabled: live, refetchInterval: 30_000, refetchIntervalInBackground: false } },
  );

  useEffect(() => {
    const sync = () => setEnabled(desktopNotificationsEnabled());
    sync();
    window.addEventListener(DESKTOP_NOTIFICATION_CHANGE, sync);
    return () => window.removeEventListener(DESKTOP_NOTIFICATION_CHANGE, sync);
  }, []);

  useEffect(() => {
    if (!notifications.data) return;
    const ids = new Set(notifications.data.map((notification) => notification.id));
    if (!seen.current) {
      seen.current = ids;
      return;
    }
    notifications.data.filter((notification) => !seen.current!.has(notification.id)).forEach((notification) => void sendDesktopNotification(notification.title));
    seen.current = ids;
  }, [notifications.data]);

  return null;
}
