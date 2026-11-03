'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FileDto } from '@miceplans/contracts';
import { ApiError, deleteFile, downloadFile, getToken, listFiles, uploadFile } from '@/lib/api';

const STATUS_LABEL: Record<FileDto['status'], string> = { pending: '변환 중', ready: '검색 가능', failed: '변환 실패' };
const ACCEPT = '.txt,.md,.markdown,.csv,.xlsx,.docx,.pdf';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLL_MS = 3000;

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);

/**
 * 행사 자료 파일(명세 F-10). 올린 파일은 서버가 Markdown으로 변환해 위키 검색과 AI 출처에 포함한다.
 * 세션 토큰이 없거나 행사 ID가 서버의 것이 아니면(목업 데이터) 표시하지 않는다.
 */
export function EventFiles({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [files, setFiles] = useState<FileDto[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const live = UUID.test(eventId) && Boolean(getToken());

  const refresh = useCallback(async () => {
    try {
      setFiles(await listFiles(eventId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '파일 목록을 불러오지 못했다');
    }
  }, [eventId]);

  useEffect(() => { if (live) void refresh(); }, [live, refresh]);
  // 변환이 끝나기를 기다리는 파일이 있을 때만 갱신한다.
  const waiting = files?.some((f) => f.status === 'pending') ?? false;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, refresh]);

  if (!live) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '요청에 실패했다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="자료 파일" className="mt-[24px] flex w-full flex-col gap-[12px] rounded-md border border-border bg-surface p-[16px]">
      <header className="flex items-center justify-between gap-[12px]">
        <div className="flex flex-col gap-[2px]">
          <h2 className="text-base font-semibold text-fg">자료 파일</h2>
          <p className="text-2xs text-fg-secondary">txt·md·csv·xlsx·docx·pdf, 최대 20MB. 올리면 변환되어 검색과 AI 출처에 포함된다.</p>
        </div>
        {canManage && (
          <>
            <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(() => uploadFile(eventId, f)); }} />
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="h-[32px] rounded-sm bg-brand px-[12px] text-2xs font-semibold text-fg-inverse disabled:opacity-50">파일 올리기</button>
          </>
        )}
      </header>
      {error && <p role="alert" className="rounded-sm bg-notice-bg px-[12px] py-[8px] text-2xs text-notice">{error}</p>}
      {files && files.length === 0 && <p className="text-2xs text-fg-secondary">올린 파일이 없다.</p>}
      <ul className="flex flex-col divide-y divide-border">
        {files?.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-[8px] py-[8px]">
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="truncate text-base text-fg">{f.name}</span>
              <span className="text-2xs text-fg-secondary">
                {size(f.sizeBytes)} · {STATUS_LABEL[f.status]}
                {f.status === 'failed' && f.error ? ` — ${f.error}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-[8px] text-2xs">
              {f.docId && <Link href={`/wiki?doc=${f.docId}`} className="text-brand underline">변환 문서</Link>}
              <button type="button" onClick={() => void run(() => downloadFile(f))} className="text-fg-secondary underline">원본</button>
              {canManage && <button type="button" disabled={busy} onClick={() => void run(() => deleteFile(f.id))} className="text-notice underline">삭제</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
