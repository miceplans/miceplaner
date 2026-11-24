'use client';

import { useState } from 'react';

/** 행사에 지정할 Client 계정 선택창. 목록은 Client 계정 API에서 가져온다. */
export function ClientSelect({
  value,
  accounts,
  onChange,
}: {
  /** 현재 표시 이름(지정된 Client가 없으면 빈 값). */
  value: string;
  accounts: { id: string; name: string; companyName: string | null }[];
  onChange: (accountId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md px-[8px] py-[4px] text-base text-fg hover:bg-surface-subtle"
      >
        {value || 'Client 선택'}
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 top-full z-20 m-0 mt-[4px] flex max-h-[240px] min-w-[200px] list-none flex-col overflow-auto rounded-xl bg-surface p-[4px] shadow-card">
          {value ? (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="w-full rounded-md px-[10px] py-[6px] text-left text-base text-fg-tertiary hover:bg-surface-subtle"
              >
                지정 안 함
              </button>
            </li>
          ) : null}
          {accounts.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full rounded-md px-[10px] py-[6px] text-left text-base hover:bg-surface-subtle ${c.name === value ? 'font-medium text-brand' : 'text-fg'}`}
              >
                {c.companyName || c.name}
              </button>
            </li>
          ))}
          {!accounts.length && <li className="px-[10px] py-[6px] text-base text-fg-tertiary">등록된 Client 계정이 없습니다.</li>}
        </ul>
      )}
    </div>
  );
}
