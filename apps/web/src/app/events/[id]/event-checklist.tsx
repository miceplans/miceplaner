'use client';

import { useState } from 'react';

const A = '/assets/event-detail';

export type CheckItem = {
  id: string;
  title: string;
  done: boolean;
  date?: string;
  owner?: string;
  late?: boolean;
  children?: CheckItem[];
};

export type Progress = { done: number; total: number };

/** 하위 항목이 있으면 하위 항목의 합, 없으면 자기 자신 1건으로 센다. */
export function countLeaves(items: CheckItem[]): Progress {
  return items.reduce<Progress>(
    (acc, item) => {
      if (item.children?.length) {
        const c = countLeaves(item.children);
        return { done: acc.done + c.done, total: acc.total + c.total };
      }
      return { done: acc.done + (item.done ? 1 : 0), total: acc.total + 1 };
    },
    { done: 0, total: 0 },
  );
}

/** 하위 항목이 모두 완료되면 상위 항목도 완료로 맞춘다. */
function normalize(item: CheckItem): CheckItem {
  if (!item.children?.length) return item;
  const children = item.children.map(normalize);
  return { ...item, children, done: children.every((c) => c.done) };
}

function mapTree(items: CheckItem[], id: string, fn: (item: CheckItem) => CheckItem): CheckItem[] {
  return items.map((item) => (item.id === id ? fn(item) : item.children ? { ...item, children: mapTree(item.children, id, fn) } : item));
}

function setAll(item: CheckItem, done: boolean): CheckItem {
  return { ...item, done, children: item.children?.map((c) => setAll(c, done)) };
}

export function toggleItem(items: CheckItem[], id: string): CheckItem[] {
  return mapTree(items, id, (item) => setAll(item, !item.done)).map(normalize);
}

export function addChild(items: CheckItem[], parentId: string, title: string): CheckItem[] {
  const child: CheckItem = { id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, title, done: false };
  return mapTree(items, parentId, (item) => ({ ...item, children: [...(item.children ?? []), child] })).map(normalize);
}

export function addRoot(items: CheckItem[], title: string): CheckItem[] {
  return [...items, { id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, title, done: false }];
}

export function removeItem(items: CheckItem[], id: string): CheckItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => (item.children ? { ...item, children: removeItem(item.children, id) } : item))
    .map(normalize);
}

function Checkbox({ state, label, onClick }: { state: 'on' | 'off' | 'mixed'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'mixed' ? 'mixed' : state === 'on'}
      aria-label={label}
      onClick={onClick}
      className={`flex size-[17px] shrink-0 items-center justify-center rounded-md ${
        state === 'on' ? 'bg-success-solid' : state === 'mixed' ? 'bg-brand-tint ring-[1.5px] ring-inset ring-brand' : 'border-[1.5px] border-solid border-[#c7cedf] bg-surface'
      }`}
    >
      {state === 'on' && <img alt="" src={`${A}/check.svg`} className="size-[10px]" />}
      {state === 'mixed' && <span className="h-[2px] w-[7px] rounded-full bg-brand" />}
    </button>
  );
}

function NewItemInput({ placeholder, onSubmit, onCancel }: { placeholder: string; onSubmit: (title: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const title = value.trim();
    if (title) onSubmit(title);
    else onCancel();
  };
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={onCancel}
      className="h-[28px] min-w-0 flex-1 rounded-md border border-solid border-border bg-surface px-[8px] text-base text-fg outline-none placeholder:text-fg-tertiary focus:border-brand"
    />
  );
}

function statusOf(item: CheckItem) {
  if (item.done) return { text: '완료', tone: 'text-fg-tertiary', dot: 'dot-done' };
  if (item.late) return { text: '지연', tone: 'text-error-delay', dot: 'dot-delay' };
  return { text: '예정', tone: 'text-info', dot: 'dot-plan' };
}

type RowProps = {
  item: CheckItem;
  depth: number;
  showStatus: boolean;
  onChange: (next: (items: CheckItem[]) => CheckItem[]) => void;
};

function Row({ item, depth, showStatus, onChange }: RowProps) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const hasChildren = !!item.children?.length;
  const progress = hasChildren ? countLeaves([item]) : null;
  const state = hasChildren ? (progress!.done === progress!.total ? 'on' : progress!.done > 0 ? 'mixed' : 'off') : item.done ? 'on' : 'off';
  const status = statusOf(item);

  return (
    <li className="list-none">
      <div className="group flex min-h-[36px] items-center gap-[10px] rounded-md pr-[4px] hover:bg-surface-sunken" style={{ paddingLeft: depth * 24 }}>
        <button
          type="button"
          aria-label={open ? '하위 항목 접기' : '하위 항목 펼치기'}
          aria-expanded={hasChildren ? open : undefined}
          disabled={!hasChildren}
          onClick={() => setOpen((v) => !v)}
          className={`flex size-[16px] shrink-0 items-center justify-center text-[10px] text-fg-tertiary ${hasChildren ? '' : 'invisible'}`}
        >
          <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        </button>
        <Checkbox state={state} label={`${item.title} 완료 표시`} onClick={() => onChange((items) => toggleItem(items, item.id))} />
        {showStatus && depth === 0 && (
          <span className={`flex w-[40px] shrink-0 items-center gap-[6px] text-sm ${status.tone}`}>
            <img alt="" src={`${A}/${status.dot}.svg`} className="size-[7px]" />
            {status.text}
          </span>
        )}
        <span className={`min-w-0 truncate text-base ${item.done ? 'text-fg-tertiary line-through' : depth === 0 ? 'font-medium text-fg' : 'text-fg'}`}>{item.title}</span>
        {progress && (
          <span className={`shrink-0 rounded-full px-[7px] py-px text-2xs font-semibold tabular-nums ${progress.done === progress.total ? 'bg-success-bg text-success-deep' : 'bg-surface-chip text-fg-secondary'}`}>
            {progress.done}/{progress.total}
          </span>
        )}
        <span className="min-w-px flex-1" />
        <button
          type="button"
          aria-label={`${item.title} 하위 항목 추가`}
          onClick={() => { setOpen(true); setAdding(true); }}
          className="flex h-[22px] items-center rounded-md px-[6px] text-xs text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
        >
          + 하위
        </button>
        <button
          type="button"
          aria-label={`${item.title} 삭제`}
          onClick={() => onChange((items) => removeItem(items, item.id))}
          className="flex size-[22px] items-center justify-center rounded-md text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
        {item.date && <span className="whitespace-nowrap text-base text-fg-secondary">{item.date}</span>}
        {item.owner && <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-tint text-2xs font-semibold text-brand">{item.owner}</span>}
      </div>
      {open && (hasChildren || adding) && (
        <ul className="m-0 p-0">
          {item.children?.map((child) => (
            <Row key={child.id} item={child} depth={depth + 1} showStatus={showStatus} onChange={onChange} />
          ))}
          {adding && (
            <li className="flex min-h-[36px] list-none items-center pr-[4px]" style={{ paddingLeft: (depth + 1) * 24 + 26 }}>
              <NewItemInput
                placeholder="하위 할 일 입력 후 Enter"
                onSubmit={(title) => { onChange((items) => addChild(items, item.id, title)); setAdding(false); }}
                onCancel={() => setAdding(false)}
              />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export function Checklist({
  items,
  onChange,
  label,
  showStatus = false,
}: {
  items: CheckItem[];
  onChange: (next: (items: CheckItem[]) => CheckItem[]) => void;
  label: string;
  showStatus?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const { done, total } = countLeaves(items);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-[8px] py-[12px]">
      <div className="flex items-center gap-[10px] px-[2px]">
        <span className="text-base font-semibold tabular-nums text-fg">{done}/{total}</span>
        <span className="text-sm text-fg-secondary">완료</span>
        <div className="h-[6px] w-[160px] overflow-hidden rounded-full bg-surface-chip" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} 진행률`}>
          <div className="h-full rounded-full bg-success-solid transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm tabular-nums text-fg-tertiary">{pct}%</span>
      </div>

      <ul className="m-0 flex w-full flex-col p-0">
        {items.map((item) => (
          <Row key={item.id} item={item} depth={0} showStatus={showStatus} onChange={onChange} />
        ))}
        <li className="flex min-h-[36px] list-none items-center gap-[10px] pl-[26px]">
          {adding ? (
            <NewItemInput
              placeholder={`새 ${label} 입력 후 Enter`}
              onSubmit={(title) => { onChange((list) => addRoot(list, title)); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex h-[36px] items-center gap-[10px] text-base text-fg-tertiary hover:text-fg-secondary">
              <img alt="" src={`${A}/plus.svg`} className="size-[14px]" />
              새 {label} 추가
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}
