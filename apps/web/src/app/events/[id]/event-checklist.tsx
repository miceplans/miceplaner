'use client';

import { createContext, useContext, useState } from 'react';
import { ConfirmDialog } from '@miceplans/ui';

import type { ProductPart } from './event-parts';

const A = '/assets/event-detail';

export type CheckItem = {
  id: string;
  title: string;
  done: boolean;
  /** 완료 처리한 시각(ms). 완료일 순 정렬에 쓴다. 없으면 마감일로 대신한다. */
  completedAt?: number;
  date?: string;
  /** 표시용 담당자 이니셜. assignee가 있으면 assignee의 첫 글자를 쓴다. */
  owner?: string;
  /** 담당자 이름. 지정된 업무는 담당자만 완료할 수 있다. */
  assignee?: string;
  /** 만든 사람. 만든 사람만 수정·삭제·담당자 지정을 할 수 있다. */
  createdBy?: string;
  late?: boolean;
  /** 제작 파트. 없으면 공통 일정으로 모든 파트 화면에 나온다. */
  part?: ProductPart;
  children?: CheckItem[];
};

/** 현재 사용자와 담당자로 지정할 수 있는 행사 인력. 목록 컴포넌트가 권한 판정에 쓴다. */
export type ItemAccess = { me: string; members: string[] };
export const ItemAccessContext = createContext<ItemAccess>({ me: '', members: [] });

/** 만든 사람 기록이 없는 기존 항목은 제한 없이 수정할 수 있다. */
export function canEditItem(item: CheckItem, me: string): boolean {
  return !item.createdBy || item.createdBy === me;
}

/** 담당자가 있으면 담당자만, 없으면 만든 사람이 완료할 수 있다. 하위 항목이 함께 바뀌므로 모두 통과해야 한다. */
export function canToggleItem(item: CheckItem, me: string): boolean {
  const own = item.assignee ? item.assignee === me : canEditItem(item, me);
  return own && (item.children ?? []).every((c) => canToggleItem(c, me));
}

/** 이니셜만 있는 기존 데이터에 담당자 이름과 만든 사람(=담당자)을 채운다. */
export function resolveOwners(items: CheckItem[], members: string[]): CheckItem[] {
  return items.map((item) => {
    const assignee = item.assignee ?? (item.owner ? members.find((m) => m.startsWith(item.owner!)) : undefined);
    return {
      ...item,
      assignee,
      createdBy: item.createdBy ?? assignee,
      children: item.children ? resolveOwners(item.children, members) : undefined,
    };
  });
}

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
  return { ...item, done, completedAt: done ? Date.now() : undefined, children: item.children?.map((c) => setAll(c, done)) };
}

function findItem(items: CheckItem[], id: string): CheckItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const found = item.children && findItem(item.children, id);
    if (found) return found;
  }
  return undefined;
}

/** 아래 변경 함수는 UI와 별개로 권한이 없으면 목록을 그대로 돌려준다. */
export function toggleItem(items: CheckItem[], id: string, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canToggleItem(target, me)) return items;
  return mapTree(items, id, (item) => setAll(item, !item.done)).map(normalize);
}

function addChild(items: CheckItem[], parentId: string, title: string, createdBy: string): CheckItem[] {
  const parent = findItem(items, parentId);
  if (!parent || !canEditItem(parent, createdBy)) return items;
  const child: CheckItem = { id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, title, done: false, createdBy };
  return mapTree(items, parentId, (item) => ({ ...item, children: [...(item.children ?? []), child] })).map(normalize);
}

export function addRoot(items: CheckItem[], title: string, createdBy?: string): CheckItem[] {
  return [...items, { id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, title, done: false, createdBy }];
}

export function assignItem(items: CheckItem[], id: string, assignee: string | undefined, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canEditItem(target, me)) return items;
  return mapTree(items, id, (item) => ({ ...item, assignee, owner: assignee?.slice(0, 1) }));
}

export function renameItem(items: CheckItem[], id: string, title: string, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canEditItem(target, me)) return items;
  return mapTree(items, id, (item) => ({ ...item, title }));
}

function removeNode(items: CheckItem[], id: string): CheckItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => (item.children ? { ...item, children: removeNode(item.children, id) } : item))
    .map(normalize);
}

export function removeItem(items: CheckItem[], id: string, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canEditItem(target, me)) return items;
  return removeNode(items, id);
}

/** 더블클릭하면 입력창으로 바뀌는 제목. Enter·포커스 이탈로 저장하고 Esc로 취소한다. 빈 값은 저장하지 않는다. */
export function EditableTitle({ title, onSave, className, readOnly = false }: { title: string; onSave: (title: string) => void; className?: string; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  if (!editing) {
    if (readOnly) return <span className={className}>{title}</span>;
    return (
      <span title="더블클릭하여 수정" onDoubleClick={() => { setValue(title); setEditing(true); }} className={className}>
        {title}
      </span>
    );
  }

  const commit = () => {
    const next = value.trim();
    if (next && next !== title) onSave(next);
    setEditing(false);
  };
  return (
    <input
      autoFocus
      value={value}
      aria-label={`${title} 이름 수정`}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={commit}
      className="h-[26px] min-w-[120px] rounded-md border border-solid border-brand bg-surface px-[6px] text-base text-fg outline-none"
    />
  );
}

/** 담당자 표시. 수정 권한이 있으면 눌러서 행사 인력 중 담당자를 지정·해제한다. */
export function AssigneeBadge({ item, onAssign }: { item: CheckItem; onAssign: (assignee: string | undefined) => void }) {
  const { me, members } = useContext(ItemAccessContext);
  const [open, setOpen] = useState(false);
  const editable = canEditItem(item, me);
  const name = item.assignee ?? item.owner;
  const label = name ? (
    <span className="whitespace-nowrap text-base text-fg-secondary">{name}</span>
  ) : (
    <span className="whitespace-nowrap text-base text-fg-tertiary">+ 담당자</span>
  );
  if (!editable) return name ? label : null;
  return (
    <span className="relative shrink-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button type="button" aria-label={`${item.title} 담당자 지정`} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex rounded-md px-[4px] hover:bg-surface-chip">
        {label}
      </button>
      {open && (
        <ul className="absolute right-0 top-[26px] z-20 m-0 flex w-[140px] list-none flex-col gap-px rounded-md border border-solid border-border bg-surface p-[4px] shadow-md">
          {members.map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => { onAssign(m); setOpen(false); }}
                className={`w-full rounded-md px-[8px] py-[5px] text-left text-base hover:bg-surface-subtle ${m === name ? 'font-medium text-brand' : 'text-fg'}`}
              >
                {m}
              </button>
            </li>
          ))}
          {name && (
            <li>
              <button type="button" onClick={() => { onAssign(undefined); setOpen(false); }} className="w-full rounded-md px-[8px] py-[5px] text-left text-base text-fg-tertiary hover:bg-surface-subtle">
                담당자 해제
              </button>
            </li>
          )}
        </ul>
      )}
    </span>
  );
}

function Checkbox({ state, label, onClick, disabled = false }: { state: 'on' | 'off' | 'mixed'; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'mixed' ? 'mixed' : state === 'on'}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? '담당자만 완료할 수 있습니다' : undefined}
      className={`flex size-[17px] shrink-0 items-center justify-center rounded-md ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${
        state === 'on' ? 'bg-success-solid' : state === 'mixed' ? 'bg-brand-tint ring-[1.5px] ring-inset ring-brand' : 'border-[1.5px] border-solid border-border-strong bg-surface'
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
  return { text: '예정', tone: 'text-scheduled', dot: 'dot-plan' };
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
  const [confirming, setConfirming] = useState(false);
  const hasChildren = !!item.children?.length;
  const progress = hasChildren ? countLeaves([item]) : null;
  const state = hasChildren ? (progress!.done === progress!.total ? 'on' : progress!.done > 0 ? 'mixed' : 'off') : item.done ? 'on' : 'off';
  const status = statusOf(item);
  const { me } = useContext(ItemAccessContext);
  const editable = canEditItem(item, me);

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
        <Checkbox state={state} label={`${item.title} 완료 표시`} disabled={!canToggleItem(item, me)} onClick={() => onChange((items) => toggleItem(items, item.id, me))} />
        {showStatus && depth === 0 && (
          <span className={`flex w-[40px] shrink-0 items-center gap-[6px] text-sm ${status.tone}`}>
            <img alt="" src={`${A}/${status.dot}.svg`} className="size-[7px]" />
            {status.text}
          </span>
        )}
        <EditableTitle
          title={item.title}
          onSave={(title) => onChange((items) => renameItem(items, item.id, title, me))}
          readOnly={!editable}
          className={`min-w-0 truncate text-base ${item.done ? 'text-fg-tertiary line-through' : depth === 0 ? 'font-medium text-fg' : 'text-fg'}`}
        />
        {progress && (
          <span className={`shrink-0 rounded-full px-[7px] py-px text-2xs font-semibold tabular-nums ${progress.done === progress.total ? 'bg-success-bg text-success-deep' : 'bg-surface-chip text-fg-secondary'}`}>
            {progress.done}/{progress.total}
          </span>
        )}
        <span className="min-w-px flex-1" />
        {editable && <button
          type="button"
          aria-label={`${item.title} 하위 항목 추가`}
          onClick={() => { setOpen(true); setAdding(true); }}
          className="flex h-[22px] items-center rounded-md px-[6px] text-xs text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
        >
          + 하위
        </button>}
        {editable && <button
          type="button"
          aria-label={`${item.title} 삭제`}
          onClick={() => setConfirming(true)}
          className="flex size-[22px] items-center justify-center rounded-md text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>}
        {item.date && <span className="whitespace-nowrap text-base text-fg-secondary">{item.date}</span>}
        <AssigneeBadge item={item} onAssign={(a) => onChange((items) => assignItem(items, item.id, a, me))} />
      </div>
      {confirming && (
        <ConfirmDialog
          title={`'${item.title}'을(를) 삭제할까요?`}
          body={hasChildren ? '하위 항목까지 모두 삭제되며 복구할 수 없습니다.' : '삭제한 항목은 복구할 수 없습니다.'}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            onChange((items) => removeItem(items, item.id, me));
            setConfirming(false);
          }}
        />
      )}
      {open && (hasChildren || adding) && (
        <ul className="m-0 p-0">
          {item.children?.map((child) => (
            <Row key={child.id} item={child} depth={depth + 1} showStatus={showStatus} onChange={onChange} />
          ))}
          {adding && (
            <li className="flex min-h-[36px] list-none items-center pr-[4px]" style={{ paddingLeft: (depth + 1) * 24 + 26 }}>
              <NewItemInput
                placeholder="하위 할 일 입력 후 Enter"
                onSubmit={(title) => { onChange((items) => addChild(items, item.id, title, me)); setAdding(false); }}
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
  const { me } = useContext(ItemAccessContext);
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
              onSubmit={(title) => { onChange((list) => addRoot(list, title, me)); setAdding(false); }}
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
