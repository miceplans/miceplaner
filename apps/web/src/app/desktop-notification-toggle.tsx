'use client';

import { useEffect, useState } from 'react';
import { toast } from '@miceplans/ui';
import { DESKTOP_NOTIFICATION_CHANGE, desktopNotificationsEnabled, disableDesktopNotifications, enableDesktopNotifications, isDesktopShell } from '@/lib/desktop';

/** 알림 권한 요청은 사용자가 이 버튼을 눌렀을 때만 일어난다. */
export function DesktopNotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDesktop(isDesktopShell());
      setEnabled(desktopNotificationsEnabled());
    };
    sync();
    window.addEventListener(DESKTOP_NOTIFICATION_CHANGE, sync);
    return () => window.removeEventListener(DESKTOP_NOTIFICATION_CHANGE, sync);
  }, []);

  if (!desktop) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (enabled) {
          disableDesktopNotifications();
          return;
        }
        void enableDesktopNotifications().then((granted) => {
          if (!granted) toast.error('운영체제 알림 권한이 허용되지 않았다');
        });
      }}
      className="flex h-[30px] items-center rounded-sm border border-solid border-border bg-surface px-[11px] text-xs font-medium text-fg-secondary"
    >
      {enabled ? '데스크톱 알림 끄기' : '데스크톱 알림 켜기'}
    </button>
  );
}
