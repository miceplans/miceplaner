'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@miceplans/ui';
import Link from 'next/link';
import type { FileDto } from '@miceplans/contracts';
import { FILE_TOO_LARGE_MESSAGE, MAX_FILE_BYTES, MAX_FILE_MB } from '@miceplans/contracts/limits';
import { ApiError, getToken } from '@/lib/api';
import { downloadFile, getListEventFilesQueryKey, useDeleteFile, useListEventFiles, useUploadEventFile } from '@/lib/api/generated/endpoints';

const STATUS: Record<FileDto['status'], { label: string; cls: string }> = {
  pending: { label: '변환 중', cls: 'bg-surface-chip text-fg-secondary' },
  ready: { label: '검색 가능', cls: 'bg-brand-green/10 text-brand-green' },
  failed: { label: '변환 실패', cls: 'bg-brand-tint text-brand' },
};
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
const hasFiles = (e: DragEvent | globalThis.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** 보내기 전에 형식·크기를 검사한다. 서버도 같은 기준(415·413)으로 거부한다. */
function rejectReason(file: File): string | null {
  if (!EXTENSIONS.includes(extOf(file.name))) return `${file.name}: 지원하지 않는 형식입니다 (txt·md·csv·xlsx·docx·pdf).`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: ${FILE_TOO_LARGE_MESSAGE.replace(/^\[413\]\s*/, '')}`;
  return null;
}

function UploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

/**
 * 행사 자료 파일(명세 F-10). 올린 파일은 서버가 Markdown으로 변환해 위키 검색과 AI 출처에 포함한다.
 * 세션 토큰이 없거나 행사 ID가 서버에 없으면 표시하지 않는다.
 */
export function EventFiles({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [uploading, setUploading] = useState<{ key: string; name: string }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
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

  // 드롭 영역 밖에 파일을 떨어뜨리면 브라우저가 그 파일을 열어 화면을 떠난다. 업로드할 수 있는 동안에는 막는다.
  useEffect(() => {
    if (!live || !canManage) return;
    const block = (e: globalThis.DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, [live, canManage]);

  const upload = useUploadEventFile();
  const remove = useDeleteFile();

  if (!live) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListEventFilesQueryKey(eventId) });
  const fail = (e: unknown, fallback: string) => toast.error(e instanceof ApiError ? e.message : fallback);

  /** 여러 파일을 차례로 올린다. 한 파일이 실패해도 나머지는 계속 올린다. */
  const uploadFiles = async (picked: File[]) => {
    const ok: File[] = [];
    for (const f of picked) {
      const reason = rejectReason(f);
      if (reason) toast.error(reason);
      else ok.push(f);
    }
    if (!ok.length) return;
    const batch = ok.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, file: f }));
    setUploading((u) => [...u, ...batch.map(({ key, name }) => ({ key, name }))]);
    for (const item of batch) {
      try {
        await upload.mutateAsync({ eventId, data: { file: item.file } });
        await refresh();
      } catch (e) {
        fail(e, `[500] ${item.name} 업로드에 실패했습니다.`);
      } finally {
        setUploading((u) => u.filter((x) => x.key !== item.key));
      }
    }
  };

  const deleteFile = async (f: FileDto) => {
    setDeleting(f.id);
    try {
      await remove.mutateAsync({ id: f.id });
      await refresh();
    } catch (e) {
      fail(e, '[500] 파일을 삭제하지 못했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  // 자식 요소를 지날 때마다 enter/leave가 번갈아 와서 깜빡이지 않도록 깊이를 센다.
  const dropHandlers = canManage
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        },
        onDragOver: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: () => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          void uploadFiles(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  const empty = files && files.length === 0 && uploading.length === 0;

  return (
    <section aria-label="자료 파일" className="mt-[24px] flex w-full flex-col gap-[12px] rounded-xl border border-solid border-border bg-surface p-[20px]">
      <header className="flex flex-col gap-[2px]">
        <h2 className="m-0 text-base font-semibold text-fg">자료 파일</h2>
        <p className="m-0 text-sm text-fg-secondary">올린 파일은 변환되어 위키 검색과 AI 출처에 포함됩니다.</p>
      </header>

      {canManage && (
        <div
          {...dropHandlers}
          className={`flex flex-col items-center justify-center gap-[8px] rounded-lg border-2 border-dashed px-[16px] py-[24px] text-center transition-colors ${
            dragging ? 'border-brand bg-brand-tint' : 'border-border bg-surface-subtle'
          }`}
        >
          <span className={`flex size-[40px] items-center justify-center rounded-full ${dragging ? 'bg-surface text-brand' : 'bg-surface-chip text-fg-secondary'}`}>
            <UploadIcon className="size-[22px]" />
          </span>
          <p className="m-0 text-base text-fg">
            {dragging ? (
              '여기에 놓으면 업로드됩니다'
            ) : (
              <>
                파일을 끌어 놓거나{' '}
                <button type="button" onClick={() => input.current?.click()} className="font-semibold text-brand underline-offset-2 hover:underline">
                  파일 선택
                </button>
              </>
            )}
          </p>
          <p className="m-0 text-xs text-fg-tertiary">txt · md · csv · xlsx · docx · pdf · 파일당 최대 {MAX_FILE_MB}MB · 여러 개 선택 가능</p>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = '';
              void uploadFiles(picked);
            }}
          />
        </div>
      )}

      {list.isPending && <p className="m-0 py-[8px] text-sm text-fg-tertiary">파일 목록을 불러오는 중입니다…</p>}
      {empty && <p className="m-0 py-[8px] text-sm text-fg-tertiary">{canManage ? '아직 올린 파일이 없습니다.' : '올린 파일이 없습니다. 파일은 PM·AM이 올릴 수 있습니다.'}</p>}

      {(uploading.length > 0 || (files && files.length > 0)) && (
        <ul className="m-0 flex list-none flex-col divide-y divide-border-soft p-0">
          {uploading.map((u) => (
            <li key={u.key} className="flex items-center gap-[12px] py-[10px]">
              <FileBadge name={u.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="truncate text-base text-fg">{u.name}</span>
                <span className="text-xs text-fg-tertiary">업로드 중…</span>
              </div>
              <span aria-hidden className="size-[16px] shrink-0 animate-spin rounded-full border-2 border-solid border-border border-t-brand" />
            </li>
          ))}
          {files?.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-[12px] py-[10px]">
              <FileBadge name={f.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="truncate text-base text-fg" title={f.name}>{f.name}</span>
                <span className="flex flex-wrap items-center gap-[6px] text-xs text-fg-tertiary">
                  {size(f.sizeBytes)}
                  <span className={`rounded-sm px-[6px] py-[1px] font-medium ${STATUS[f.status].cls}`}>{STATUS[f.status].label}</span>
                  {f.status === 'failed' && f.error && <span className="text-brand">{f.error}</span>}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-[4px] text-sm">
                {f.docId && (
                  <Link href={`/wiki?doc=${f.docId}`} className="rounded-sm px-[8px] py-[4px] text-fg-secondary hover:bg-surface-subtle">
                    변환 문서
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void saveFile(f).catch((e) => fail(e, '[500] 원본을 내려받지 못했습니다.'))}
                  className="rounded-sm px-[8px] py-[4px] text-fg-secondary hover:bg-surface-subtle"
                >
                  원본 받기
                </button>
                {canManage && (
                  <button
                    type="button"
                    disabled={deleting === f.id}
                    onClick={() => void deleteFile(f)}
                    className="rounded-sm px-[8px] py-[4px] text-brand hover:bg-brand-tint disabled:opacity-50"
                  >
                    {deleting === f.id ? '삭제 중…' : '삭제'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FileBadge({ name }: { name: string }) {
  const ext = extOf(name) || 'file';
  return (
    <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-md bg-surface-chip text-[10px] font-bold uppercase text-fg-secondary">
      {ext.slice(0, 4)}
    </span>
  );
}
