'use client';

import { useState } from 'react';
import { Button, Dialog, DatePicker, Input, Select } from '@miceplans/ui';
import type { Column, EventOption, TaskFormValues } from './task-board-model';

export function TaskDialog({
  mode,
  columns,
  events,
  initial,
  defaultStatus = '할 일',
  defaultEvent,
  onCancel,
  onSubmit,
}: {
  mode: 'add' | 'edit';
  columns: Column[];
  events: EventOption[];
  initial?: TaskFormValues;
  defaultStatus?: string;
  defaultEvent: string;
  onCancel: () => void;
  onSubmit: (values: TaskFormValues) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [event, setEvent] = useState(initial?.event ?? defaultEvent);
  const [schedule, setSchedule] = useState(initial?.schedule ?? '');
  const [due, setDue] = useState(initial?.due ?? '');
  const [who, setWho] = useState(initial?.who ?? '');
  const [status, setStatus] = useState(initial?.status ?? defaultStatus);
  const label = 'flex flex-col gap-[4px] text-sm text-fg-secondary';
  const canSubmit = !!title.trim() && !!event;
  return (
    <Dialog onClose={onCancel}>
      <form
        role="dialog"
        aria-label={mode === 'add' ? 'Task 추가' : 'Task 수정'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onSubmit({
            title: title.trim(),
            event,
            schedule: schedule.trim() || '일정 미지정',
            due: due || null,
            who,
            status,
          });
        }}
        className="flex w-[420px] max-w-full flex-col gap-[14px] rounded-lg bg-surface p-[20px] shadow-card"
      >
        <h2 className="m-0 text-lg font-semibold text-fg">{mode === 'add' ? 'Task 추가' : 'Task 수정'}</h2>
        <label className={label}>
          제목
          <Input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full" />
        </label>
        <div className="flex gap-[12px]">
          <label className={`${label} flex-1`}>
            상태
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
              {columns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </label>
          <label className={`${label} flex-1`}>
            행사
            <Select value={event} onChange={(e) => setEvent(e.target.value)} className="w-full">
              {!events.some((e) => e.name === event) && event ? <option value={event}>{event}</option> : null}
              {events.map((e) => (
                <option key={e.id} value={e.name}>{e.name}</option>
              ))}
            </Select>
          </label>
        </div>
        <label className={label}>
          일정
          <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="예: 리헤설" className="w-full" />
        </label>
        <div className="flex gap-[12px]">
          <label className={`${label} flex-1`}>
            마감일
            <div className="relative">
              <DatePicker value={due} onChange={setDue} className="w-full" />
              {due ? (
                <button
                  type="button"
                  onClick={() => setDue('')}
                  className="absolute top-1/2 right-[8px] -translate-y-1/2 text-2xs whitespace-nowrap text-fg-secondary hover:text-fg"
                >
                  지우기
                </button>
              ) : null}
            </div>
          </label>
          <label className={`${label} flex-1`}>
            담당자
            <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="담당자 이름" className="w-full" />
          </label>
        </div>
        <div className="flex justify-end gap-[8px]">
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={!canSubmit}>{mode === 'add' ? '추가' : '저장'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
