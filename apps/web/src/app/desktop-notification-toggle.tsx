'use client';

import { useEffect, useState } from 'react';
import { toast } from '@miceplans/ui';
import {
  DESKTOP_NOTIFICATION_CHANGE,
  desktopNotificationsEnabled,
  disableDesktopNotifications,
  enableDesktopNotifications,
  isDesktopShell,
} from '@/lib/desktop';

export function DesktopNotificationToggle() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setAvailable(isDesktopShell());
      setEnabled(desktopNotificationsEnabled());
    };
    refresh();
    window.addEventListener(DESKTOP_NOTIFICATION_CHANGE, refresh);
    return () => window.removeEventListener(DESKTOP_NOTIFICATION_CHANGE, refresh);
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (enabled) {
          disableDesktopNotifications();
          return;
        }
        void enableDesktopNotifications().then((granted) => {
          if (!granted) toast.error('[403] 운영체제 알림 권한이 필요합니다.');
        });
      }}
      className="flex h-[30px] items-center rounded-sm border border-solid border-border bg-surface px-[11px] text-xs font-medium text-fg-secondary"
    >
      {enabled ? '데스크톱 알림 끄기' : '데스크톱 알림 켜기'}
    </button>
  );
}
