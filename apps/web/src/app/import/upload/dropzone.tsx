'use client';

import { useRef, useState } from 'react';

const A = '/assets/import';

export function Dropzone() {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setFileName(e.dataTransfer.files[0]?.name ?? null);
      }}
      className="flex h-[320px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-[3px] border-dashed border-brand bg-surface-sunken"
    >
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      <div className="relative h-[79px] w-[109px] shrink-0">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img alt="" src={`${A}/folder.png`} className="absolute top-[-44.01%] left-[-59.51%] h-[184.27%] w-[215.79%] max-w-none" />
        </div>
      </div>
      <p className="text-md font-medium whitespace-nowrap text-brand">{fileName ?? '파일 찾아보기'}</p>
    </div>
  );
}
