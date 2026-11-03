'use client';

import { useEffect, useRef, useState } from 'react';

import { Input } from '@miceplans/ui';

import { CAT_COLORS, PRODUCT_CATALOG, type ProductCatalogItem } from './product-catalog';

const norm = (s: string) => s.toLowerCase().trim();

function matches(item: ProductCatalogItem, q: string) {
  const nq = norm(q);
  if (!nq) return true;
  return [item.name, item.category, item.tags, item.material].some((v) => norm(v).includes(nq));
}

type Props = {
  value: string;
  onChange: (name: string) => void;
  onSelect: (item: ProductCatalogItem) => void;
};

export function ProductNameCombobox({ value, onChange, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const visible = PRODUCT_CATALOG.filter((it) => matches(it, value));

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!r || !panel) return;
      panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 328))}px`;
      panel.style.top = `${Math.min(r.bottom + 4, window.innerHeight - 274)}px`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const choose = (item: ProductCatalogItem) => {
    onSelect(item);
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  return (
    <div ref={rootRef} className="relative w-[120px] shrink-0">
      <Input
        ref={inputRef}
        aria-label="name"
        value={value}
        autoComplete="off"
        placeholder="품명 검색"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            if (!visible.length) return;
            setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % visible.length : (i - 1 + visible.length) % visible.length));
          } else if (e.key === 'Enter') {
            if (open) {
              e.preventDefault();
              const idx = active >= 0 ? active : 0;
              if (visible[idx]) choose(visible[idx]);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        size="lg"
        className="w-[120px]"
      />
      {open && (
        <div ref={panelRef} className="fixed z-40 max-h-[264px] w-[320px] overflow-y-auto rounded-lg border border-solid border-border-strong bg-surface p-[4px] shadow-card">
          {visible.length === 0 ? (
            <div className="px-[10px] py-[14px] text-[14px] text-fg-secondary">검색 결과가 없습니다</div>
          ) : (
            visible.slice(0, 60).map((it, i) => (
              <button
                key={`${it.category}-${it.name}-${i}`}
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(it);
                }}
                className={`flex w-full cursor-pointer flex-col gap-[2px] rounded-md px-[10px] py-[7px] text-left ${i === active ? 'bg-surface-chip' : 'hover:bg-surface-subtle'}`}
              >
                <span className="flex w-full items-center justify-between gap-[8px]">
                  <span className="truncate text-[14px] text-fg">{it.name}</span>
                  <span className={`flex h-[19px] shrink-0 items-center rounded-md px-[7px] text-[11px] font-bold ${CAT_COLORS[it.category] ?? 'bg-surface-cell text-fg-secondary'}`}>
                    {it.category}
                  </span>
                </span>
                <span className="truncate text-xs text-fg-secondary">{it.size || it.material}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
