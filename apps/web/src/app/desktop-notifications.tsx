'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/api';
import { useNotificationsList } from '@/lib/api/generated/endpoints';
import { DESKTOP_NOTIFICATION_CHANGE, desktopNotificationsEnabled, isDesktopShell, sendDesktopNotification } from '@/lib/desktop';

/** 새 알림만 OS에 전달한다. 기존 알림은 앱을 연 순간에 다시 표시하지 않는다. */
export function DesktopNotifications() {
  const initialIds = useRef<Set<number> | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const refresh = () => setEnabled(desktopNotificationsEnabled());
    refresh();
    window.addEventListener(DESKTOP_NOTIFICATION_CHANGE, refresh);
    return () => window.removeEventListener(DESKTOP_NOTIFICATION_CHANGE, refresh);
  }, []);
  const active = isDesktopShell() && enabled && Boolean(getToken());
  const notifications = useNotificationsList({ unread: true, limit: 20 }, {
    query: { enabled: active, refetchInterval: 30_000, refetchIntervalInBackground: false },
  });

  useEffect(() => {
    const items = notifications.data;
    if (!items) return;
    if (!initialIds.current) {
      initialIds.current = new Set(items.map((item) => item.id));
      return;
    }
    for (const item of items) {
      if (!initialIds.current.has(item.id)) void sendDesktopNotification(item.title);
    }
    initialIds.current = new Set(items.map((item) => item.id));
  }, [notifications.data]);

  return null;
}
