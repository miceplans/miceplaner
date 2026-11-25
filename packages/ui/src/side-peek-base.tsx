'use client';

import { Textarea } from './field';

/** 담당자 미지정 값. Select 옵션 값으로 쓴다. */
export const UNASSIGNED = '';

/* ---------- 패널 내용 (서버 저장) ---------- */

export type SubtaskItem = { id: string; title: string; who: string; done: boolean };
export type TaskItem = { id: string; title: string; who: string; subs: SubtaskItem[] };
export type LinkItem = { id: string; name: string; url: string };
export type SidePeekContent = { assignees: string[]; description: string; clientMemo: string; tasks: TaskItem[]; links: LinkItem[] };

/**
 * 패널 내용을 읽고 쓰는 저장소. 앱이 서버 API로 구현해 넘긴다.
 * save는 바뀐 필드만 받고, 담당자 version 충돌이면 { conflict: true }를 돌려준다. 그 밖의 실패는 throw한다.
 */
export type SidePeekStore = {
  load: (key: string) => Promise<{ content: SidePeekContent; version: number }>;
  save: (key: string, patch: Partial<SidePeekContent>, baseVersion: number) => Promise<{ conflict: false; version: number } | { conflict: true }>;
};

export const newId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** http(s) 링크만 허용한다. 스킴이 없으면 https를 붙인다. */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function SidePeekSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[12px]">
      <p className="h-[16.433px] whitespace-nowrap text-md font-bold tracking-[0.4695px] text-fg-strong">{label}</p>
      {children}
    </div>
  );
}

export function SidePeekTextBlock({ children }: { children: string }) {
  return (
    <div className="flex w-full items-center justify-center rounded-md bg-surface-subtle px-[16.433px] py-[12.912px]">
      <p className="w-full text-lg text-fg-strong">{children}</p>
    </div>
  );
}

/** 설명·메모처럼 바로 고쳐 쓰는 여러 줄 입력. */
export function SidePeekTextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <SidePeekSection label={label}>
      <Textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        variant="ghost"
        rows={3}
        className="w-full rounded-md bg-surface-subtle px-[16px] py-[12px] text-lg text-fg-strong focus:bg-surface-muted"
      />
    </SidePeekSection>
  );
}

export type AgendaKind = 'todo' | 'program' | 'task' | 'subtask';
export type AgendaItem = { kind: AgendaKind; title: string; meta?: string; done?: boolean };
