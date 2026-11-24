'use client';

import { useState } from 'react';
import { ALL, type EventOption } from './task-board-model';

export function EventSelect({ value, onChange, events }: { value: string; onChange: (v: string) => void; events: EventOption[] }) {
  const [open, setOpen] = useState(false);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const item = 'flex w-full items-center gap-[8px] px-[12px] py-[8px] text-left text-base hover:bg-surface-chip';
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[32px] items-center gap-[6px] rounded-sm border border-solid border-border px-[10px] text-base font-semibold whitespace-nowrap text-fg"
      >
        {value}
        <span aria-hidden className="text-2xs text-fg-secondary">▾</span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul role="listbox" className="absolute left-0 top-[36px] z-40 max-h-[320px] w-[240px] overflow-y-auto rounded-md border border-solid border-border bg-surface py-[4px] shadow-card">
            <li>
              <button type="button" role="option" aria-selected={value === ALL} onClick={() => pick(ALL)} className={item}>
                {ALL}
              </button>
            </li>
            {events.map((e, i) => (
              <li key={e.id} className={i > 0 && events[i - 1]!.mine !== e.mine ? 'mt-[4px] border-t border-solid border-border pt-[4px]' : ''}>
                <button type="button" role="option" aria-selected={value === e.name} onClick={() => pick(e.name)} className={`${item} ${value === e.name ? 'text-brand' : 'text-fg'}`}>
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.mine ? <span className="rounded-xs bg-brand-tint px-[6px] text-2xs text-brand">내 행사</span> : null}
                  <span className="text-2xs text-fg-secondary">{e.startDate.slice(2, 7).replace('-', '.')}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
