'use client';

import {
  Children, isValidElement, useEffect, useId, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode,
} from 'react';
import { SIZE_CLS, type FieldSize, type FieldVariant } from './field';

export type SelectOption<T extends string = string> = { value: T; label: string };

/** onChange에 넘기는 이벤트. 네이티브 select의 change 이벤트와 같은 모양이라 기존 사용처를 그대로 둔다. */
export type SelectChangeEvent<T extends string = string> = { target: { value: T } };

export type SelectProps<T extends string = string> = {
  value?: T;
  onChange?: (event: SelectChangeEvent<T>) => void;
  size?: FieldSize;
  variant?: FieldVariant;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** 트리거 툴팁. 네이티브 title과 같다. */
  title?: string;
  /** 트리거에 자동 포커스. 인라인 셀 편집처럼 열자마자 키보드로 고르는 경우에 쓴다. */
  autoFocus?: boolean;
  /** 트리거 키 핸들러. preventDefault()하면 드롭다운의 기본 키 동작(화살표·Enter·Space로 열기)을 막는다. */
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  /** children 대신 옵션 목록을 넘길 수 있다. */
  options?: ReadonlyArray<SelectOption<T>>;
  /** `<option>` children으로 옵션을 넘길 수 있다(네이티브 select와 같다). */
  children?: ReactNode;
  /** 드롭다운 위에 검색 입력을 띄워 옵션을 필터한다. 목록이 긴 고객사·사용자 선택에 쓴다. */
  searchable?: boolean;
  /** '+ 새 항목' 입력을 허용한다. 값은 생성할 항목의 명사(예: '고객사')다. */
  creatable?: string;
  /**
   * creatable에서 Enter로 확정한 이름을 받는다. 생성 후 value를 선택하면 된다.
   * Promise를 reject하면 입력 내용을 지우지 않고 입력 모드를 유지한다(오류 표시는 호출 쪽).
   */
  onCreate?: (name: string) => void | Promise<unknown>;
};

const fold = (s: string) => s.toLocaleLowerCase('ko-KR');

const toText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  return '';
};

function extractOptions<T extends string>(options: ReadonlyArray<SelectOption<T>> | undefined, children: ReactNode): SelectOption<T>[] {
  if (options) return options.map((o) => ({ ...o }));
  const out: SelectOption<T>[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<{ value?: T; children?: ReactNode }>(child) && (child.type as unknown) === 'option') {
      const label = toText(child.props.children);
      out.push({ value: (child.props.value === undefined ? label : child.props.value) as T, label });
    }
  });
  return out;
}

const POPUP_CLS =
  'absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-solid border-border bg-surface shadow-[0_8px_24px_rgba(23,23,28,0.12)]';

const ROW_CLS =
  'flex w-full min-w-0 items-center justify-between gap-[8px] rounded-md px-[10px] py-[8px] text-left text-base outline-none';

/**
 * 표준 드롭다운. DatePicker와 같은 스타일의 팝업을 띄우고, 검색과 '+ 새 항목' 입력을 지원한다.
 * 검색 입력과 생성 입력의 Enter는 폼 제출을 일으키지 않는다.
 */
export function Select<T extends string = string>({
  value = '' as T,
  onChange,
  size = 'md',
  variant = 'outline',
  invalid = false,
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
  title,
  autoFocus = false,
  onKeyDown,
  options,
  children,
  searchable = false,
  creatable,
  onCreate,
}: SelectProps<T>) {
  const opts = useMemo(() => extractOptions(options, children), [options, children]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createText, setCreateText] = useState('');
  const [createPending, setCreatePending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLInputElement>(null);
  const popId = useId();

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? opts.filter((o) => fold(o.label).includes(q)) : opts;
  }, [opts, query]);
  const exactMatch = query.trim() !== '' && opts.some((o) => o.label === query.trim());
  const showCreate = creatable !== undefined && !exactMatch;
  /** 키보드로 순환하는 대상. 생성 행은 목록 맨 위에 온다. */
  const actionable = useMemo<(number | 'create')[]>(
    () => [...(showCreate ? ['create' as const] : []), ...filtered.map((_, i) => i)],
    [showCreate, filtered],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && creating) createRef.current?.focus();
    else if (open && searchable) searchRef.current?.focus();
  }, [open, creating, searchable]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setCreating(false);
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    if (disabled) return;
    setQuery('');
    setCreating(false);
    setHighlight(highlightIndex(opts, value));
    setOpen(true);
  };

  const pick = (option: SelectOption<T>) => {
    onChange?.({ target: { value: option.value } });
    close();
  };

  const enterCreate = (text: string) => {
    if (!creatable) return;
    setCreateText(text);
    setCreating(true);
  };

  const commitCreate = async () => {
    const name = createText.trim();
    if (name === '' || createPending || !onCreate) return;
    setCreatePending(true);
    try {
      await onCreate(name);
      close();
    } catch {
      // 호출 쪽에서 오류를 표시한다. 입력 내용과 입력 모드를 유지해 다시 제출할 수 있게 한다.
    } finally {
      setCreatePending(false);
    }
  };

  const move = (delta: number) => {
    if (actionable.length === 0) return;
    setHighlight((h) => (h + delta + actionable.length) % actionable.length);
  };

  const fire = (item: number | 'create' | undefined) => {
    if (item === 'create') enterCreate(query.trim());
    else if (item !== undefined) pick(filtered[item]);
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggle();
    } else if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); fire(actionable[highlight]); }
    }
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); fire(actionable[highlight]); }
  };

  const onCreateKey = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); void commitCreate(); }
  };

  const selected = opts.find((o) => o.value === value);
  const placeholderShown = selected === undefined && value === '';
  const display = selected?.label ?? (placeholderShown ? (opts[0]?.value === '' ? opts[0].label : '') : value);

  const borderCls = invalid ? 'border-error!' : open ? 'border-brand' : 'border-border';
  const triggerCls =
    variant === 'outline'
      ? `border border-solid ${borderCls} bg-surface`
      : variant === 'chip'
        ? 'bg-surface-chip'
        : '';

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        disabled={disabled}
        title={title}
        autoFocus={autoFocus}
        onClick={toggle}
        onKeyDown={onTriggerKey}
        className={`flex w-full min-w-0 items-center justify-between gap-[8px] text-left outline-none focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLS[size]} ${triggerCls}`}
      >
        <span className={`truncate ${placeholderShown ? 'text-fg-tertiary' : variant === 'ghost' ? '' : 'text-fg'}`}>{display}</span>
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-fg-tertiary transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M4.5 6.5 8 10l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div id={popId} role="dialog" aria-label={ariaLabel ?? '선택'} className={POPUP_CLS}>
          {creating ? (
            <div className="flex flex-col gap-[6px] p-[8px]">
              <input
                ref={createRef}
                value={createText}
                maxLength={200}
                disabled={createPending}
                onChange={(e) => setCreateText(e.target.value)}
                onKeyDown={onCreateKey}
                placeholder={`새 ${creatable}명 입력`}
                aria-label={`새 ${creatable} 이름`}
                className="h-[32px] w-full min-w-0 rounded-md border border-solid border-border bg-surface px-[10px] text-base text-fg outline-none placeholder:text-fg-tertiary focus:border-brand disabled:opacity-60"
              />
              <p className="m-0 text-2xs text-fg-tertiary">{createPending ? '등록 중…' : 'Enter로 등록 · Esc로 취소'}</p>
            </div>
          ) : (
            <>
              {searchable && (
                <div className="border-b border-solid border-border-soft p-[8px]">
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      const q = e.target.value;
                      setQuery(q);
                      const qt = q.trim();
                      const list = qt ? opts.filter((o) => fold(o.label).includes(fold(qt))) : opts;
                      const exact = list.findIndex((o) => o.label === qt);
                      setHighlight(exact >= 0 ? exact : 0);
                    }}
                    onKeyDown={onSearchKey}
                    placeholder="검색"
                    aria-label="옵션 검색"
                    className="h-[28px] w-full min-w-0 rounded-md border border-solid border-border bg-surface px-[8px] text-sm text-fg outline-none placeholder:text-fg-tertiary focus:border-brand"
                  />
                </div>
              )}
              <ul ref={listRef} role="listbox" className="max-h-[240px] overflow-y-auto p-[4px]">
                {showCreate && (
                  <li key="__create" role="option" aria-selected={false}>
                    <button
                      type="button"
                      data-active={actionable[highlight] === 'create'}
                      onMouseEnter={() => setHighlight(0)}
                      onClick={() => enterCreate(query.trim())}
                      className={`${ROW_CLS} font-medium text-brand ${actionable[highlight] === 'create' ? 'bg-brand-tint' : 'hover:bg-brand-tint'}`}
                    >
                      {query.trim() === '' ? `+ ${creatable} 새로 입력` : `+ '${query.trim()}' 추가`}
                    </button>
                  </li>
                )}
                {filtered.map((o, i) => {
                  const active = actionable[highlight] === i;
                  const isSelected = o.value === value;
                  return (
                    <li key={`${o.value}-${i}`} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        data-active={active}
                        onMouseEnter={() => setHighlight(actionable.indexOf(i))}
                        onClick={() => pick(o)}
                        className={`${ROW_CLS} ${active ? 'bg-surface-chip' : 'hover:bg-surface-chip'}`}
                      >
                        <span className={`truncate ${isSelected ? 'font-semibold text-fg' : 'text-fg'}`}>{o.label}</span>
                        {isSelected && (
                          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand">
                            <path d="m3 8.5 3.5 3.5L13 5" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && !showCreate && (
                  <li className="px-[10px] py-[8px] text-sm text-fg-tertiary">결과 없음</li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 팝업을 열 때 현재 값의 위치를 하이라이트 시작점으로 쓴다. 없으면 맨 위다. */
function highlightIndex<T extends string>(opts: SelectOption<T>[], value: T): number {
  const idx = opts.findIndex((o) => o.value === value);
  return idx >= 0 ? idx : 0;
}
