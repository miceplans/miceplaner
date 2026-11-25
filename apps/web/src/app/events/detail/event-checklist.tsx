'use client';

import { createContext, useContext, useRef, useState } from 'react';
import { ConfirmDialog, Input, Select } from '@miceplans/ui';

import {
  addChild,
  addRoot,
  assignItem,
  canEditItem,
  canToggleItem,
  countLeaves,
  removeItem,
  renameItem,
  setWorkflowStatus,
  toggleItem,
  type CheckItem,
  type ItemAccess,
} from './event-checklist-model';

const A = '/assets/event-detail';

export const ItemAccessContext = createContext<ItemAccess>({ me: '', members: [] });

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
    <Input
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
      size="sm"
      className="min-w-[120px] border-brand! text-base!"
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
  // Enter·Esc로 닫히면서 blur가 또 오더라도 한 번만 처리한다.
  const settled = useRef(false);
  const finish = (save: boolean) => {
    if (settled.current) return;
    settled.current = true;
    const title = value.trim();
    if (save && title) onSubmit(title);
    else onCancel();
  };
  return (
    <Input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      // 다른 곳을 눌러도 입력한 내용을 버리지 않고 추가한다. 빈 값이면 닫기만 한다.
      onBlur={() => finish(true)}
      size="sm"
      className="flex-1"
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
        {depth > 0 && editable && (
          <Select
            aria-label={`${item.title} 상태`}
            value={item.done ? '완료' : item.workflowStatus ?? '진행'}
            onChange={(e) => {
              const next: string = e.target.value;
              if (next === '삭제') {
                setConfirming(true);
                return;
              }
              onChange((items) => setWorkflowStatus(items, item.id, next as NonNullable<CheckItem['workflowStatus']>, me));
            }}
            size="sm"
            className="w-[92px] shrink-0"
          >
            {(['진행', '검토 대기', '완료', '보류', '삭제'] as const).map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        )}
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
