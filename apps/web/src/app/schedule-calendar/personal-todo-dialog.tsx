'use client';

import { useState } from 'react';
import { Button, Checkbox, DatePicker, Dialog, Input, SegmentControl, type PersonalTodo } from '@miceplans/ui';

type DateMode = 'due' | 'range';

const label = 'flex flex-col gap-[4px] text-sm text-fg-secondary';

/** 목록에 보여 줄 날짜 문구. 저장 형식은 YYYY-MM-DD, 화면은 MM.DD다. */
function fmtDate(todo: PersonalTodo): string {
  const md = (iso: string) => `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
  if (todo.start && todo.end) return todo.start === todo.end ? md(todo.start) : `${md(todo.start)} ~ ${md(todo.end)}`;
  return todo.due ? `${md(todo.due)} 마감` : '날짜 없음';
}

/**
 * 개인 Todo(내 할 일) 관리 팝업. 추가·완료 표시·삭제만 하며 브라우저(local-first)에 바로 저장한다.
 * 다른 사용자에게는 보이지 않는다.
 */
export function PersonalTodoDialog({ todos, onChange, onClose }: { todos: PersonalTodo[]; onChange: (fn: (prev: PersonalTodo[]) => PersonalTodo[]) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<DateMode>('due');
  const [due, setDue] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const datesOk = mode === 'due' ? due !== '' : start !== '' && end !== '' && start <= end;
  const canAdd = title.trim() !== '' && datesOk;

  const add = () => {
    if (!canAdd) return;
    const todo: PersonalTodo = mode === 'due' ? { id: crypto.randomUUID(), title: title.trim(), due } : { id: crypto.randomUUID(), title: title.trim(), start, end };
    onChange((prev) => [...prev, todo]);
    setTitle('');
  };

  const sorted = [...todos].sort((a, b) => (a.start ?? a.due ?? '').localeCompare(b.start ?? b.due ?? ''));

  return (
    <Dialog onClose={onClose}>
      <div role="dialog" aria-label="내 할 일" onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-[440px] max-w-full flex-col gap-[16px] rounded-lg bg-surface p-[20px] shadow-card">
        <div className="flex flex-col gap-[4px]">
          <h2 className="m-0 text-lg font-semibold text-fg">내 할 일</h2>
          <p className="m-0 text-sm text-fg-tertiary">이 브라우저에만 저장되며 다른 사람에게는 보이지 않습니다.</p>
        </div>

        <form
          className="flex flex-col gap-[12px]"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className={label}>
            제목
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="할 일 입력" className="w-full" />
          </label>
          <div className="flex">
            <SegmentControl<DateMode>
              options={[
                { value: 'due', label: '마감일' },
                { value: 'range', label: '기간' },
              ]}
              value={mode}
              onChange={setMode}
              size="sm"
            />
          </div>
          {mode === 'due' ? (
            <label className={label}>
              마감일
              <DatePicker value={due} onChange={setDue} aria-label="마감일" className="w-full" />
            </label>
          ) : (
            <div className="flex gap-[12px]">
              <label className={`${label} flex-1`}>
                시작일
                <DatePicker value={start} onChange={setStart} max={end || undefined} aria-label="시작일" className="w-full" />
              </label>
              <label className={`${label} flex-1`}>
                종료일
                <DatePicker value={end} onChange={setEnd} min={start || undefined} aria-label="종료일" className="w-full" />
              </label>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={!canAdd}>
              추가
            </Button>
          </div>
        </form>

        <div className="flex min-h-0 flex-col gap-[4px] overflow-y-auto border-t border-solid border-border pt-[12px]">
          {sorted.length === 0 ? (
            <p className="m-0 py-[8px] text-center text-sm text-fg-tertiary">등록한 할 일이 없습니다.</p>
          ) : (
            sorted.map((todo) => (
              <div key={todo.id} className="flex items-center gap-[8px] rounded-sm px-[4px] py-[6px] hover:bg-surface-muted">
                <Checkbox
                  aria-label={`${todo.title} 완료`}
                  checked={!!todo.done}
                  onChange={(e) => {
                    const done = e.target.checked;
                    onChange((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done } : t)));
                  }}
                />
                <span className={`min-w-0 flex-1 truncate text-base text-fg ${todo.done ? 'text-fg-tertiary line-through' : ''}`}>{todo.title}</span>
                <span className="shrink-0 text-sm text-fg-tertiary">{fmtDate(todo)}</span>
                <button
                  type="button"
                  aria-label={`${todo.title} 삭제`}
                  onClick={() => onChange((prev) => prev.filter((t) => t.id !== todo.id))}
                  className="shrink-0 rounded-xs px-[6px] text-sm text-fg-tertiary hover:bg-surface-chip hover:text-fg"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
