'use client';

import type { ReactNode } from 'react';
import { create } from 'zustand';

type ToastItem = { id: number; message: string; tone: 'error' | 'info' };

const DURATION_MS = 5000;
let seq = 0;

const useToasts = create<{ items: ToastItem[] }>()(() => ({ items: [] }));

const dismiss = (id: number) => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));

const push = (tone: ToastItem['tone'], message: string) => {
  // 같은 메시지가 이미 떠 있으면 중복해서 쌓지 않는다.
  if (useToasts.getState().items.some((t) => t.message === message && t.tone === tone)) return;
  const id = ++seq;
  useToasts.setState((s) => ({ items: [...s.items, { id, message, tone }].slice(-4) }));
  setTimeout(() => dismiss(id), DURATION_MS);
};

/** 어디서든 호출할 수 있는 토스트. `ToastViewport`가 마운트되어 있어야 보인다. */
export const toast = {
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

/** 앱 루트에 한 번 마운트한다. */
export function ToastViewport(): ReactNode {
  const list = useToasts((s) => s.items);
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
