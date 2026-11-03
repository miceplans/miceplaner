'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

type ToastItem = { id: number; message: string; tone: 'error' | 'info' };

const DURATION_MS = 5000;
let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const dismiss = (id: number) => {
  items = items.filter((t) => t.id !== id);
  emit();
};

const push = (tone: ToastItem['tone'], message: string) => {
  // 같은 메시지가 이미 떠 있으면 중복해서 쌓지 않는다.
  if (items.some((t) => t.message === message && t.tone === tone)) return;
  const id = ++seq;
  items = [...items, { id, message, tone }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), DURATION_MS);
};

/** 어디서든 호출할 수 있는 토스트. `ToastViewport`가 마운트되어 있어야 보인다. */
export const toast = {
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

const EMPTY: ToastItem[] = [];

/** 앱 루트에 한 번 마운트한다. */
export function ToastViewport(): ReactNode {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  if (list.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-[24px] left-1/2 z-[100] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-[8px]">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-[8px] rounded-md px-[14px] py-[10px] text-sm shadow-panel ${
            t.tone === 'error' ? 'bg-notice-bg text-notice' : 'bg-fg text-fg-inverse'
          }`}
        >
          <span className="min-w-px flex-1">{t.message}</span>
          <button type="button" aria-label="닫기" onClick={() => dismiss(t.id)} className="shrink-0 border-0 bg-transparent p-0 text-sm leading-none text-inherit opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
