'use client';

import { useContext, useState } from 'react';
import { ConfirmDialog } from '@miceplans/ui';

import { AssigneeBadge, EditableTitle, ItemAccessContext, addRoot, assignItem, canEditItem, canToggleItem, removeItem, renameItem, toggleItem, type CheckItem } from './event-checklist';
import { matchPart, type PartFilter } from './event-parts';
import { DEFAULT_FILTER, applyFilter, isFilterActive, type ItemFilter } from './event-filter';

const A = '/assets/event-detail';

/** 스케줄 상태(완료/지연/예정) 표시. 스케줄 목록과 할 일 탭의 스케줄 헤더가 함께 쓴다. */
export function statusOf(item: CheckItem) {
  if (item.done) return { text: '완료', tone: 'text-fg-tertiary', dot: 'dot-done' };
  if (item.late) return { text: '지연', tone: 'text-error-delay', dot: 'dot-delay' };
  return { text: '예정', tone: 'text-scheduled', dot: 'dot-plan' };
}

/** 스케줄 탭의 평면 목록. 상태 점을 누르면 완료/예정이 바뀐다. 하위 항목은 할 일 탭에서 다룬다. */
export function ScheduleList({
  items,
  onChange,
  part = '전체',
  filter = DEFAULT_FILTER,
}: {
  items: CheckItem[];
  onChange: (next: (items: CheckItem[]) => CheckItem[]) => void;
  part?: PartFilter;
  filter?: ItemFilter;
}) {
  const { me } = useContext(ItemAccessContext);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = applyFilter(matchPart(items, part), filter, me);
  const deletingItem = deletingId ? (visible.find((x) => x.id === deletingId) ?? null) : null;

  const submit = () => {
    const title = value.trim();
    if (title) onChange((list) => addRoot(list, title, me));
    setValue('');
    setAdding(false);
  };

  return (
    <ul className="m-0 flex w-full list-none flex-col p-0 py-[8px]">
      {visible.map((item) => {
        const status = statusOf(item);
        return (
          <li key={item.id} className="group flex h-[36px] items-center gap-[10px]">
            <button
              type="button"
              aria-label={`${item.title} ${item.done ? '완료 취소' : '완료 표시'}`}
              disabled={!canToggleItem(item, me)}
              title={canToggleItem(item, me) ? undefined : '담당자만 완료할 수 있습니다'}
              onClick={() => onChange((list) => toggleItem(list, item.id, me))}
              className="flex size-[16px] shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              <img alt="" src={`${A}/${status.dot}.svg`} className="size-[7px]" />
            </button>
            <span className={`w-[24px] shrink-0 whitespace-nowrap text-xs ${status.tone}`}>{status.text}</span>
            <EditableTitle
              title={item.title}
              onSave={(title) => onChange((list) => renameItem(list, item.id, title, me))}
              readOnly={!canEditItem(item, me)}
              className="whitespace-nowrap text-md text-fg"
            />
            {item.part && (
              <span className="shrink-0 rounded-md bg-surface-chip px-[6px] py-px text-2xs font-semibold text-fg-secondary">{item.part}</span>
            )}
            <span className="min-w-px flex-1" />
            {canEditItem(item, me) && <button
              type="button"
              aria-label={`${item.title} 삭제`}
              onClick={() => setDeletingId(item.id)}
              className="flex size-[20px] shrink-0 items-center justify-center rounded-md text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>}
            {item.date && <span className="whitespace-nowrap text-base text-fg-secondary">{item.date}</span>}
            <AssigneeBadge item={item} onAssign={(a) => onChange((list) => assignItem(list, item.id, a, me))} />
          </li>
        );
      })}
      {!visible.length && (
        <li className="flex h-[36px] items-center px-[17px] text-base text-fg-tertiary">{isFilterActive(filter) ? '조건에 맞는 항목이 없습니다.' : '해당 파트의 일정이 없습니다.'}</li>
      )}
      <li className="flex h-[36px] items-center px-[17px]">
        {adding ? (
          <input
            autoFocus
            value={value}
            placeholder="새 Schedule 입력 후 Enter"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
              if (e.key === 'Escape') { setValue(''); setAdding(false); }
            }}
            onBlur={() => { setValue(''); setAdding(false); }}
            className="h-[28px] min-w-0 flex-1 rounded-md border border-solid border-border bg-surface px-[8px] text-[13px] text-fg outline-none placeholder:text-fg-tertiary focus:border-brand"
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-[8px] text-[13px] text-fg-tertiary hover:text-fg-secondary">
            <img alt="" src={`${A}/plus-schedule.svg`} className="size-[14px]" />
            새 Schedule 추가
          </button>
        )}
      </li>
      {deletingItem && (
        <ConfirmDialog
          title={`'${deletingItem.title}'을(를) 삭제할까요?`}
          body="삭제한 일정은 복구할 수 없습니다."
          onClose={() => setDeletingId(null)}
          onConfirm={() => {
            onChange((list) => removeItem(list, deletingItem.id, me));
            setDeletingId(null);
          }}
        />
      )}
    </ul>
  );
}
