'use client';

const NOTIFICATION_PREFERENCE = 'miceplans.desktop-notifications';
export const DESKTOP_NOTIFICATION_CHANGE = 'miceplans:desktop-notification-change';

export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function desktopNotificationsEnabled(): boolean {
  return isDesktopShell() && window.localStorage.getItem(NOTIFICATION_PREFERENCE) === 'enabled';
}

export async function enableDesktopNotifications(): Promise<boolean> {
  if (!isDesktopShell()) return false;

  const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
  const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  if (granted) {
    window.localStorage.setItem(NOTIFICATION_PREFERENCE, 'enabled');
    window.dispatchEvent(new Event(DESKTOP_NOTIFICATION_CHANGE));
  }
  return granted;
}

export function disableDesktopNotifications(): void {
  if (!isDesktopShell()) return;
  window.localStorage.removeItem(NOTIFICATION_PREFERENCE);
  window.dispatchEvent(new Event(DESKTOP_NOTIFICATION_CHANGE));
}

export async function sendDesktopNotification(body: string): Promise<void> {
  if (!desktopNotificationsEnabled()) return;
  const { sendNotification } = await import('@tauri-apps/plugin-notification');
  await sendNotification({ title: 'MICEPLANS', body });
}
