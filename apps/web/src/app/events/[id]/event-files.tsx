'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@miceplans/ui';
import Link from 'next/link';
import type { FileDto } from '@miceplans/contracts';
import { ApiError, getToken } from '@/lib/api';
import { downloadFile, getListEventFilesQueryKey, useDeleteFile, useListEventFiles, useUploadEventFile } from '@/lib/api/generated/endpoints';

const STATUS_LABEL: Record<FileDto['status'], string> = { pending: '변환 중', ready: '검색 가능', failed: '변환 실패' };
const ACCEPT = '.txt,.md,.markdown,.csv,.xlsx,.docx,.pdf';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLL_MS = 3000;

/** 토큰이 헤더에 있어야 해서 링크 대신 받아서 저장한다. */
async function saveFile(file: Pick<FileDto, 'id' | 'name'>): Promise<void> {
  const url = URL.createObjectURL(await downloadFile(file.id));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);

/**
 * 행사 자료 파일(명세 F-10). 올린 파일은 서버가 Markdown으로 변환해 위키 검색과 AI 출처에 포함한다.
 * 세션 토큰이 없거나 행사 ID가 서버의 것이 아니면(목업 데이터) 표시하지 않는다.
 */
export function EventFiles({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const live = UUID.test(eventId) && Boolean(getToken());
  const queryClient = useQueryClient();

  // 변환이 끝나기를 기다리는 파일이 있을 때만 폴링한다. TanStack Query가 요청 중복·겹침을 막고,
  // 숨겨진 탭에서는 멈추며(refetchIntervalInBackground 기본 false), 오류가 나면 폴링을 중단한다.
  const list = useListEventFiles(eventId, undefined, {
    query: {
      enabled: live,
      refetchInterval: (q) => (q.state.status !== 'error' && q.state.data?.some((f) => f.status === 'pending') ? POLL_MS : false),
    },
  });
  const files = list.data;
  useEffect(() => {
    if (list.isError) toast.error(list.error instanceof ApiError ? list.error.message : '[500] 파일 목록을 불러오지 못했습니다.');
  }, [list.isError, list.error]);

  const upload = useUploadEventFile();
  const remove = useDeleteFile();

  if (!live) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: getListEventFilesQueryKey(eventId) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : '[500] 요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('[413] 파일은 최대 20MB까지 올릴 수 없습니다.');
      return;
    }
    void run(() => upload.mutateAsync({ eventId, data: { file } }));
  };

  return (
    <section
      aria-label="자료 파일"
      onDragEnter={canManage ? (event) => { event.preventDefault(); setDragging(true); } : undefined}
      onDragOver={canManage ? (event) => event.preventDefault() : undefined}
      onDragLeave={canManage ? (event) => { if (event.currentTarget === event.target) setDragging(false); } : undefined}
      onDrop={canManage ? (event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files.item(0); if (file) uploadFile(file); } : undefined}
      className={`mt-[24px] flex w-full flex-col gap-[12px] rounded-md border bg-surface p-[16px] ${dragging ? 'border-brand' : 'border-border'}`}
    >
      <header className="flex items-center justify-between gap-[12px]">
        <div className="flex flex-col gap-[2px]">
          <h2 className="text-base font-semibold text-fg">자료 파일</h2>
          <p className="text-2xs text-fg-secondary">txt·md·csv·xlsx·docx·pdf, 최대 20MB. 파일을 끌어 놓거나 올리면 변환되어 검색과 AI 출처에 포함된다.</p>
        </div>
        {canManage && (
          <>
            <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadFile(f); }} />
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="h-[32px] rounded-sm bg-brand px-[12px] text-2xs font-semibold text-fg-inverse disabled:opacity-50">파일 올리기</button>
          </>
        )}
      </header>
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
              <button type="button" onClick={() => void run(() => saveFile(f))} className="text-fg-secondary underline">원본</button>
              {canManage && <button type="button" disabled={busy} onClick={() => void run(() => remove.mutateAsync({ id: f.id }))} className="text-notice underline">삭제</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
