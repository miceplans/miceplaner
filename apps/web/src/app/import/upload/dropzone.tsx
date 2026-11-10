'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@miceplans/ui';
import { useImportExcelUpload } from '../../../lib/api/generated/endpoints';
import { ApiError } from '../../../lib/api';

const A = '/assets/import';

export function Dropzone() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const upload = useImportExcelUpload();

  const submit = async (file: File) => {
    setFileName(file.name);
    try {
      const job = await upload.mutateAsync({ data: { file } });
      router.push(`/import/sheet?job=${job.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 업로드에 실패했습니다.');
      setFileName(null);
    }
  };

  const busy = upload.isPending;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={busy}
      onClick={() => !busy && input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && input.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && !busy) void submit(file);
      }}
      className="flex h-[320px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-[3px] border-dashed border-brand bg-surface-sunken"
    >
      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void submit(file);
          e.target.value = '';
        }}
      />
      <div className="relative h-[79px] w-[109px] shrink-0">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img alt="" src={`${A}/folder.png`} className="absolute top-[-44.01%] left-[-59.51%] h-[184.27%] w-[215.79%] max-w-none" />
        </div>
      </div>
      <p className="text-md font-medium whitespace-nowrap text-brand">{busy ? '업로드 중…' : (fileName ?? '파일 찾아보기')}</p>
      {!busy && <p className="m-0 text-xs whitespace-nowrap text-fg-tertiary">.xlsx 또는 .csv (최대 20MB)</p>}
    </div>
  );
}
