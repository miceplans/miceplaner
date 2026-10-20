'use client';

import { useState } from 'react';
import { addRoot, toggleItem, type CheckItem } from './event-checklist';

const A = '/assets/event-detail';

function statusOf(item: CheckItem) {
  if (item.done) return { text: '완료', tone: 'text-fg-tertiary', dot: 'dot-done' };
  if (item.late) return { text: '지연', tone: 'text-error-delay', dot: 'dot-delay' };
  return { text: '예정', tone: 'text-[#2e5fd8]', dot: 'dot-plan' };
}

/** 스케줄 탭의 평면 목록. 상태 점을 누르면 완료/예정이 바뀐다. 하위 항목은 할 일 탭에서 다룬다. */
export function ScheduleList({ items, onChange }: { items: CheckItem[]; onChange: (next: (items: CheckItem[]) => CheckItem[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  const submit = () => {
    const title = value.trim();
    if (title) onChange((list) => addRoot(list, title));
    setValue('');
    setAdding(false);
  };

  return (
    <ul className="m-0 flex w-full list-none flex-col p-0 py-[8px]">
      {items.map((item) => {
        const status = statusOf(item);
        return (
          <li key={item.id} className="flex h-[36px] items-center gap-[10px]">
            <button
              type="button"
              aria-label={`${item.title} ${item.done ? '완료 취소' : '완료 표시'}`}
              onClick={() => onChange((list) => toggleItem(list, item.id))}
              className="flex size-[16px] shrink-0 items-center justify-center"
            >
              <img alt="" src={`${A}/${status.dot}.svg`} className="size-[7px]" />
            </button>
            <span className={`w-[24px] shrink-0 whitespace-nowrap text-xs ${status.tone}`}>{status.text}</span>
            <span className="whitespace-nowrap text-[13.5px] text-fg">{item.title}</span>
            <span className="min-w-px flex-1" />
            {item.date && <span className="whitespace-nowrap text-[13px] text-fg-secondary">{item.date}</span>}
            {item.owner && (
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-tint text-[10px] font-semibold text-brand">{item.owner}</span>
            )}
          </li>
        );
      })}
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
    </ul>
  );
}
