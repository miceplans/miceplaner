'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@miceplans/ui';
import Link from 'next/link';
import type { FileDto } from '@miceplans/contracts';
import { FILE_TOO_LARGE_MESSAGE, MAX_FILE_BYTES, MAX_FILE_MB } from '@miceplans/contracts/limits';
import { ApiError, getToken } from '@/lib/api';
import { downloadFile, getListEventFilesQueryKey, useDeleteFile, useListEventFiles, useUploadEventFile } from '@/lib/api/generated/endpoints';

/** 서버가 변환할 수 있는 형식(`@miceplans/knowledge/parse`의 SUPPORTED_EXTENSIONS와 같다). */
const EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'xlsx', 'docx', 'pdf'];
const ACCEPT = EXTENSIONS.map((e) => `.${e}`).join(',');
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
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

/** 보내기 전에 막을 수 있는 오류. 서버도 같은 기준(413·415)으로 거부한다. */
function precheck(file: File): string | null {
  if (!EXTENSIONS.includes(extOf(file.name))) return `[415] 지원하지 않는 형식입니다 (${EXTENSIONS.join(', ')}).`;
  if (file.size > MAX_FILE_BYTES) return FILE_TOO_LARGE_MESSAGE;
  return null;
}

/** 화면에만 있는 업로드 행. 올리는 중이거나 실패한 파일을 목록 위에 남겨 결과가 묻히지 않게 한다. */
type Pending = { key: string; name: string; size: number; error?: string };

/**
 * 행사 자료 파일(명세 F-10). 올린 파일은 서버가 Markdown으로 변환해 위키 검색과 AI 출처에 포함한다.
 * 세션 토큰이 없거나 행사 ID가 서버에 없으면 표시하지 않는다.
 */
export function EventFiles({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [pending, setPending] = useState<Pending[]>([]);
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListEventFilesQueryKey(eventId) });
  const fail = (e: unknown) => (e instanceof ApiError ? e.message : '[500] 요청에 실패했습니다.');

  const uploadFiles = (picked: File[]) => {
    for (const file of picked) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const error = precheck(file);
      setPending((list) => [...list, { key, name: file.name, size: file.size, error: error ?? undefined }]);
      if (error) continue;
      void upload
        .mutateAsync({ eventId, data: { file } })
        .then(async () => {
          await refresh();
          setPending((list) => list.filter((p) => p.key !== key));
        })
        .catch((e: unknown) => setPending((list) => list.map((p) => (p.key === key ? { ...p, error: fail(e) } : p))));
    }
  };

  const deleteFile = (id: string) =>
    void remove
      .mutateAsync({ id })
      .then(refresh)
      .catch((e: unknown) => toast.error(fail(e)));

  const download = (file: FileDto) => void saveFile(file).catch((e: unknown) => toast.error(fail(e)));

  const empty = files?.length === 0 && pending.length === 0;
  const action = 'rounded-sm px-[6px] py-[2px] text-2xs text-fg-secondary hover:bg-surface-chip hover:text-fg';

  return (
    <section
      aria-label="자료 파일"
      onDragEnter={canManage ? (event) => { event.preventDefault(); setDragging(true); } : undefined}
      onDragOver={canManage ? (event) => event.preventDefault() : undefined}
      onDragLeave={canManage ? (event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); } : undefined}
      onDrop={canManage ? (event) => { event.preventDefault(); setDragging(false); uploadFiles([...event.dataTransfer.files]); } : undefined}
      className={`mt-[24px] flex w-full flex-col rounded-md border border-solid ${dragging ? 'border-brand bg-brand-tint' : 'border-border bg-surface'}`}
    >
      <header className="flex h-[40px] items-center gap-[8px] px-[12px]">
        <h2 className="text-sm font-semibold text-fg">자료 파일</h2>
        {files && files.length > 0 && <span className="text-2xs text-fg-tertiary">{files.length}</span>}
        <span className="flex-1" />
        {canManage && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = [...(e.target.files ?? [])];
                e.target.value = '';
                uploadFiles(picked);
              }}
            />
            <button
              type="button"
              title={`${EXTENSIONS.join(', ')} · 최대 ${MAX_FILE_MB}MB`}
              onClick={() => input.current?.click()}
              className="h-[26px] rounded-sm px-[8px] text-xs font-medium text-brand hover:bg-brand-tint"
            >
              + 파일 추가
            </button>
          </>
        )}
      </header>

      {empty && (
        <p className="border-0 border-t border-solid border-border px-[12px] py-[10px] text-2xs text-fg-tertiary">
          {canManage ? `파일을 끌어 놓거나 추가하세요 · 최대 ${MAX_FILE_MB}MB` : '올린 파일이 없습니다.'}
        </p>
      )}

      {(pending.length > 0 || (files && files.length > 0)) && (
        <ul className="m-0 flex list-none flex-col border-0 border-t border-solid border-border p-0">
          {pending.map((p) => (
            <li key={p.key} className="flex h-[36px] items-center gap-[8px] px-[12px]">
              <span className={`min-w-0 flex-1 truncate text-sm ${p.error ? 'text-fg-secondary' : 'text-fg-tertiary'}`}>{p.name}</span>
              {p.error ? (
                <>
                  <span role="alert" className="min-w-0 truncate text-2xs text-error" title={p.error}>{p.error}</span>
                  <button type="button" aria-label={`${p.name} 닫기`} onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))} className={action}>✕</button>
                </>
              ) : (
                <span role="status" className="shrink-0 text-2xs text-fg-tertiary">올리는 중…</span>
              )}
            </li>
          ))}
          {files?.map((f) => (
            <li key={f.id} className="group flex h-[36px] items-center gap-[8px] px-[12px] hover:bg-surface-sunken">
              <button type="button" onClick={() => download(f)} title="원본 받기" className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:underline">
                {f.name}
              </button>
              {f.status === 'pending' && <span className="shrink-0 text-2xs text-fg-tertiary">변환 중</span>}
              {f.status === 'failed' && <span className="shrink-0 text-2xs text-error" title={f.error ?? undefined}>변환 실패</span>}
              <span className="w-[52px] shrink-0 text-right text-2xs text-fg-tertiary">{size(f.sizeBytes)}</span>
              <span className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                {f.docId && <Link href={`/wiki?doc=${f.docId}`} className={action}>문서</Link>}
                {canManage && (
                  <button type="button" aria-label={`${f.name} 삭제`} onClick={() => deleteFile(f.id)} className={`${action} hover:text-error`}>
                    삭제
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
