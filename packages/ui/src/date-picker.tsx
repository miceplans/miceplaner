'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { buildMonthWeeks, shiftMonth } from './schedule';
import type { FieldSize } from './field';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const SIZE_CLS: Record<FieldSize, string> = {
  sm: 'h-[26px] rounded-sm px-[8px] text-xs',
  md: 'h-[32px] rounded-md px-[10px] text-base',
  lg: 'h-[40px] rounded-lg px-[12px] text-base',
};

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function parseIso(v: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

export type DatePickerProps = {
  /** YYYY-MM-DD. 빈 문자열이면 미선택. */
  value: string;
  onChange: (value: string) => void;
  /** 이 날짜(YYYY-MM-DD)보다 이른 날짜는 선택할 수 없다. */
  min?: string;
  max?: string;
  size?: FieldSize;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

/** 날짜 선택기. 네이티브 date 팝업 대신 디자인 시스템 스타일의 달력을 띄운다. */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  size = 'md',
  invalid = false,
  disabled = false,
  placeholder = '날짜 선택',
  className = '',
  'aria-label': ariaLabel,
}: DatePickerProps): ReactNode {
  const parsed = parseIso(value);
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState({ year: parsed?.year ?? now.getFullYear(), month: parsed?.month ?? now.getMonth() + 1 });
  const rootRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open && parsed) setCursor({ year: parsed.year, month: parsed.month });
    setOpen(!open);
  };

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const weeks = buildMonthWeeks(cursor.year, cursor.month, now);
  const outOfRange = (iso: string) => (min !== undefined && min !== '' && iso < min) || (max !== undefined && max !== '' && iso > max);
  const todayIso = toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        disabled={disabled}
        onClick={toggle}
        className={`flex w-full min-w-0 items-center justify-between gap-[8px] border border-solid bg-surface text-left outline-none focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLS[size]} ${invalid ? 'border-error' : open ? 'border-brand' : 'border-border'}`}
      >
        <span className={`truncate ${parsed ? 'text-fg' : 'text-fg-tertiary'}`}>
          {parsed ? `${parsed.year}. ${pad(parsed.month)}. ${pad(parsed.day)}.` : placeholder}
        </span>
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="shrink-0 text-fg-tertiary">
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          id={popId}
          role="dialog"
          aria-label="날짜 선택"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[264px] rounded-lg border border-solid border-border bg-surface p-[12px] shadow-[0_8px_24px_rgba(23,23,28,0.12)]"
        >
          <div className="mb-[8px] flex items-center justify-between">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => setCursor(shiftMonth(cursor, -1))}
              className="flex size-[28px] items-center justify-center rounded-full text-fg-secondary hover:bg-surface-chip"
            >
              ‹
            </button>
            <span className="text-base font-bold text-fg">
              {cursor.year}년 {cursor.month}월
            </span>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => setCursor(shiftMonth(cursor, 1))}
              className="flex size-[28px] items-center justify-center rounded-full text-fg-secondary hover:bg-surface-chip"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-[2px] text-center">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={`py-[4px] text-2xs font-bold ${i === 0 ? 'text-error' : 'text-fg-muted'}`}>
                {w}
              </span>
            ))}
            {weeks.flat().map((cell, i) => {
              if (!cell.d) return <span key={i} />;
              const iso = toIso(cursor.year, cursor.month, cell.d);
              const selected = iso === value;
              const blocked = outOfRange(iso);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={blocked}
                  aria-pressed={selected}
                  aria-current={cell.today ? 'date' : undefined}
                  onClick={() => pick(iso)}
                  className={`mx-auto flex size-[32px] items-center justify-center rounded-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:text-fg-disabled/40 ${
                    selected
                      ? 'bg-brand font-bold text-fg-inverse'
                      : `${cell.today ? 'font-bold text-brand ring-1 ring-brand' : i % 7 === 0 ? 'text-error' : 'text-fg'} ${blocked ? '' : 'hover:bg-surface-chip'}`
                  }`}
                >
                  {cell.d}
                </button>
              );
            })}
          </div>

          <div className="mt-[8px] flex items-center justify-between border-t border-solid border-border-soft pt-[8px] text-xs font-semibold">
            <button type="button" onClick={() => pick('')} className="rounded-sm px-[6px] py-[4px] text-fg-secondary hover:bg-surface-chip">
              지우기
            </button>
            <button
              type="button"
              disabled={outOfRange(todayIso)}
              onClick={() => pick(todayIso)}
              className="rounded-sm px-[6px] py-[4px] text-brand hover:bg-brand-tint disabled:cursor-not-allowed disabled:opacity-40"
            >
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
