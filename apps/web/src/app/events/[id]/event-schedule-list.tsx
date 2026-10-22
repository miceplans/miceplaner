'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@miceplans/ui';

import { addRoot, removeItem, toggleItem, type CheckItem } from './event-checklist';
import { matchPart, type PartFilter } from './event-parts';

const A = '/assets/event-detail';

function statusOf(item: CheckItem) {
  if (item.done) return { text: '완료', tone: 'text-fg-tertiary', dot: 'dot-done' };
  if (item.late) return { text: '지연', tone: 'text-error-delay', dot: 'dot-delay' };
  return { text: '예정', tone: 'text-scheduled', dot: 'dot-plan' };
}

/** 스케줄 탭의 평면 목록. 상태 점을 누르면 완료/예정이 바뀐다. 하위 항목은 할 일 탭에서 다룬다. */
export function ScheduleList({
  items,
  onChange,
  part = '전체',
}: {
  items: CheckItem[];
  onChange: (next: (items: CheckItem[]) => CheckItem[]) => void;
  part?: PartFilter;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = matchPart(items, part);
  const deletingItem = deletingId ? (visible.find((x) => x.id === deletingId) ?? null) : null;

  const submit = () => {
    const title = value.trim();
    if (title) onChange((list) => addRoot(list, title));
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
              onClick={() => onChange((list) => toggleItem(list, item.id))}
              className="flex size-[16px] shrink-0 items-center justify-center"
            >
              <img alt="" src={`${A}/${status.dot}.svg`} className="size-[7px]" />
            </button>
            <span className={`w-[24px] shrink-0 whitespace-nowrap text-xs ${status.tone}`}>{status.text}</span>
            <span className="whitespace-nowrap text-md text-fg">{item.title}</span>
            {item.part && (
              <span className="shrink-0 rounded-md bg-surface-chip px-[6px] py-px text-2xs font-semibold text-fg-secondary">{item.part}</span>
            )}
            <span className="min-w-px flex-1" />
            <button
              type="button"
              aria-label={`${item.title} 삭제`}
              onClick={() => setDeletingId(item.id)}
              className="flex size-[20px] shrink-0 items-center justify-center rounded-md text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>
            {item.date && <span className="whitespace-nowrap text-base text-fg-secondary">{item.date}</span>}
            {item.owner && (
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-tint text-[10px] font-semibold text-brand">{item.owner}</span>
            )}
          </li>
        );
      })}
      {!visible.length && (
        <li className="flex h-[36px] items-center px-[17px] text-base text-fg-tertiary">해당 파트의 일정이 없습니다.</li>
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
            onChange((list) => removeItem(list, deletingItem.id));
            setDeletingId(null);
          }}
        />
      )}
    </ul>
  );
}
