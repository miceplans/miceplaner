'use client';

import { useState } from 'react';
import { Input } from './field';
import { Select } from './select';
import {
  UNASSIGNED,
  newId,
  normalizeUrl,
  SidePeekSection,
  type AgendaItem,
  type AgendaKind,
  type LinkItem,
  type TaskItem,
} from './side-peek-base';

const A = '/assets/schedule';

/* ---------- 담당자 ---------- */

export function AssigneeRow({ assignees, members, onChange }: { assignees: string[]; members: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const candidates = members.filter((m) => !assignees.includes(m));
  return (
    <div className="flex min-h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
      <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
        <img alt="" src={`${A}/dd62d.svg`} className="size-[14.108px]" />
        <span className="whitespace-nowrap">담당자</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[6px]">
        {assignees.length === 0 && !adding ? <span className="text-fg-tertiary">미지정</span> : null}
        {assignees.map((name) => (
          <span key={name} className="flex items-center gap-[4px] rounded-sm bg-surface-chip px-[6px] py-[2px]">
            <span className="whitespace-nowrap">{name}</span>
            <button
              type="button"
              aria-label={`담당자 제거: ${name}`}
              onClick={() => onChange(assignees.filter((a) => a !== name))}
              className="text-2xs text-fg-tertiary hover:text-error"
            >
              ✕
            </button>
          </span>
        ))}
        {adding ? (
          candidates.length ? (
            <Select
              value={UNASSIGNED}
              autoFocus
              onChange={(e) => {
                const name = e.target.value;
                if (name) onChange([...assignees, name]);
                setAdding(false);
              }}
              aria-label="담당자 선택"
              size="sm"
              searchable
            >
              <option value={UNASSIGNED}>선택</option>
              {candidates.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          ) : (
            <span className="text-fg-tertiary">추가할 수 있는 인력이 없습니다.</span>
          )
        ) : null}
        <button
          type="button"
          aria-label={adding ? '담당자 추가 닫기' : '담당자 추가'}
          aria-expanded={adding}
          onClick={() => setAdding((v) => !v)}
          className="flex size-[18.81px] items-center justify-center rounded-md hover:bg-surface-chip"
        >
          <img alt="" src={`${A}/1d729.svg`} className="size-[9.405px]" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 이날의 내 일정 ---------- */

const AGENDA_GROUPS: { kind: AgendaKind; label: string; badge: string }[] = [
  { kind: 'todo', label: '내 할 일', badge: 'bg-brand-tint text-brand' },
  { kind: 'program', label: '프로그램', badge: 'bg-submit-bg text-submit' },
  { kind: 'task', label: '태스크', badge: 'bg-info-bg text-info' },
  { kind: 'subtask', label: '서브태스크', badge: 'bg-surface-chip text-fg-secondary' },
];

export function AgendaSection({ items }: { items: AgendaItem[] }) {
  return (
    <SidePeekSection label="이날의 내 일정">
      {items.length === 0 ? (
        <p className="text-sm text-fg-tertiary">이날 예정된 항목이 없습니다.</p>
      ) : (
        <div className="flex w-full flex-col gap-[16px]">
          {AGENDA_GROUPS.map((g) => {
            const list = items.filter((i) => i.kind === g.kind);
            if (list.length === 0) return null;
            return (
              <div key={g.kind} className="flex w-full flex-col gap-[4px]">
                <span className={`w-fit rounded-xs px-[6px] py-[2px] text-2xs font-bold ${g.badge}`}>
                  {g.label} {list.length}
                </span>
                {list.map((i, idx) => (
                  <div key={`${i.title}-${idx}`} className="flex w-full items-center gap-[8px] rounded-md px-[8px] py-[6px] hover:bg-surface-muted">
                    <span className={`size-[14px] shrink-0 rounded-xs border border-solid border-border-strong ${i.done ? 'bg-success-solid' : ''}`} aria-hidden />
                    <span className={`text-md text-fg-strong ${i.done ? 'line-through opacity-60' : ''}`}>{i.title}</span>
                    {i.meta ? <span className="ml-auto whitespace-nowrap text-sm text-fg-tertiary">{i.meta}</span> : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </SidePeekSection>
  );
}

/* ---------- 할 일 · 하위 할 일 지정 ---------- */

function AssigneeSelect({ value, members, onChange, label }: { value: string; members: string[]; onChange: (value: string) => void; label: string }) {
  const options = value && !members.includes(value) ? [value, ...members] : members;
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} size="sm" className="shrink-0">
      <option value={UNASSIGNED}>미지정</option>
      {options.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </Select>
  );
}

function SubtaskCheck({ done, onToggle }: { done: boolean; onToggle: () => void }): React.ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? 'Subtask 완료 취소' : 'Subtask 완료 처리'}
      onClick={onToggle}
      className={`flex size-[14px] shrink-0 items-center justify-center rounded-xs border text-[10px] font-bold ${
        done ? 'border-brand bg-brand text-fg-inverse' : 'border-border-strong bg-surface text-transparent hover:border-brand'
      }`}
    >
      ✓
    </button>
  );
}

/** 일정 상세에서 Task와 Subtask를 지정·관리하는 섹션. 담당자 후보는 members로 받는다. */
export function TaskSubtaskSection({
  tasks,
  members = [],
  onChange,
}: {
  tasks: TaskItem[];
  members?: string[];
  onChange: (next: TaskItem[]) => void;
}): React.ReactNode {
  const [taskDraft, setTaskDraft] = useState('');
  const [taskWho, setTaskWho] = useState<string>(UNASSIGNED);
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [subWhos, setSubWhos] = useState<Record<string, string>>({});

  const updateTask = (taskId: string, fn: (t: TaskItem) => TaskItem): void => onChange(tasks.map((t) => (t.id === taskId ? fn(t) : t)));

  const addTask = (): void => {
    const title = taskDraft.trim();
    if (!title) return;
    onChange([...tasks, { id: newId('task'), title, who: taskWho, subs: [] }]);
    setTaskDraft('');
  };

  const addSub = (task: TaskItem): void => {
    const title = (subDrafts[task.id] ?? '').trim();
    if (!title) return;
    const who = subWhos[task.id] ?? task.who;
    updateTask(task.id, (t) => ({ ...t, subs: [...t.subs, { id: newId('sub'), title, who, done: false }] }));
    setSubDrafts((prev) => ({ ...prev, [task.id]: '' }));
  };

  const doneCount = tasks.reduce((n, t) => n + t.subs.filter((s) => s.done).length, 0);
  const totalCount = tasks.reduce((n, t) => n + t.subs.length, 0);

  return (
    <div className="flex w-full flex-col gap-[12px]">
      <div className="flex items-center gap-[8px]">
        <p className="whitespace-nowrap text-md font-bold tracking-[0.4695px] text-fg-strong">할 일 · 하위 할 일</p>
        <span className="flex h-[18px] items-center justify-center rounded-md bg-border-strong px-[6px] text-2xs font-medium text-fg-secondary">
          {doneCount}/{totalCount}
        </span>
      </div>
      <div className="flex w-full flex-col gap-[8px]">
        {tasks.map((task) => (
          <div key={task.id} className="flex w-full flex-col gap-[6px] rounded-md bg-surface-subtle p-[10px]">
            <div className="flex w-full items-center gap-[8px]">
              <Input
                aria-label="할 일 제목"
                value={task.title}
                onChange={(e) => updateTask(task.id, (t) => ({ ...t, title: e.target.value }))}
                onBlur={(e) => {
                  if (!e.target.value.trim()) updateTask(task.id, (t) => ({ ...t, title: '제목 없음' }));
                }}
                variant="ghost"
                className="min-w-0 flex-1 text-md font-bold text-fg-strong"
              />
              <AssigneeSelect value={task.who} members={members} label="할 일 담당자" onChange={(who) => updateTask(task.id, (t) => ({ ...t, who }))} />
              <button
                type="button"
                aria-label={`Task 삭제: ${task.title}`}
                onClick={() => onChange(tasks.filter((t) => t.id !== task.id))}
                className="flex size-[18px] shrink-0 items-center justify-center rounded-md text-sm text-fg-tertiary hover:bg-surface-chip hover:text-error"
              >
                ✕
              </button>
            </div>
            <div className="flex w-full flex-col gap-[2px]">
              {task.subs.map((sub) => (
                <div key={sub.id} className="flex w-full items-center gap-[8px] rounded-sm px-[4px] py-[3px] hover:bg-surface">
                  <SubtaskCheck
                    done={sub.done}
                    onToggle={() => updateTask(task.id, (t) => ({ ...t, subs: t.subs.map((s) => (s.id === sub.id ? { ...s, done: !s.done } : s)) }))}
                  />
                  <Input
                    aria-label="하위 할 일 제목"
                    value={sub.title}
                    onChange={(e) => updateTask(task.id, (t) => ({ ...t, subs: t.subs.map((s) => (s.id === sub.id ? { ...s, title: e.target.value } : s)) }))}
                    variant="ghost"
                    className={`min-w-0 flex-1 text-md ${sub.done ? 'text-fg-tertiary line-through' : 'text-fg'}`}
                  />
                  <AssigneeSelect
                    value={sub.who}
                    members={members}
                    label="하위 할 일 담당자"
                    onChange={(who) => updateTask(task.id, (t) => ({ ...t, subs: t.subs.map((s) => (s.id === sub.id ? { ...s, who } : s)) }))}
                  />
                  <button
                    type="button"
                    aria-label={`Subtask 삭제: ${sub.title}`}
                    onClick={() => updateTask(task.id, (t) => ({ ...t, subs: t.subs.filter((s) => s.id !== sub.id) }))}
                    className="flex size-[18px] shrink-0 items-center justify-center rounded-md text-sm text-fg-tertiary hover:bg-surface-chip hover:text-error"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-[6px] px-[4px] py-[3px]">
                <img alt="" src={`${A}/1d729.svg`} className="size-[9px] shrink-0" />
                <Input
                  value={subDrafts[task.id] ?? ''}
                  onChange={(e) => setSubDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addSub(task);
                    }
                  }}
                  placeholder="하위 할 일 추가"
                  variant="ghost"
                  className="flex-1 text-md"
                />
                <AssigneeSelect
                  value={subWhos[task.id] ?? task.who}
                  members={members}
                  label="새 하위 할 일 담당자"
                  onChange={(who) => setSubWhos((prev) => ({ ...prev, [task.id]: who }))}
                />
                <button
                  type="button"
                  onClick={() => addSub(task)}
                  className="h-[26px] shrink-0 rounded-sm bg-surface-chip px-[8px] text-xs font-medium text-fg-secondary hover:bg-border-strong"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        ))}
        <div className="flex w-full items-center gap-[6px] rounded-md border border-dashed border-border-strong p-[8px]">
          <Input
            value={taskDraft}
            onChange={(e) => setTaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addTask();
              }
            }}
            placeholder="할 일 추가"
            size="sm"
            className="flex-1"
          />
          <AssigneeSelect value={taskWho} members={members} label="새 할 일 담당자" onChange={setTaskWho} />
          <button
            type="button"
            onClick={addTask}
            className="h-[26px] shrink-0 rounded-sm bg-brand px-[10px] text-xs font-semibold text-fg-inverse hover:opacity-90"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 관련 링크 ---------- */

export function LinksSection({ links, onChange }: { links: LinkItem[]; onChange: (next: LinkItem[]) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const add = (): void => {
    const href = normalizeUrl(url);
    if (!href) {
      setError(true);
      return;
    }
    onChange([...links, { id: newId('link'), name: name.trim() || new URL(href).hostname, url: href }]);
    setName('');
    setUrl('');
    setError(false);
  };
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      add();
    }
  };
  return (
    <SidePeekSection label="관련 링크 및 첨부">
      <div className="flex w-full flex-col gap-[2px]">
        {links.map((link) => (
          <div key={link.id} className="flex w-full items-center gap-[10.564px] rounded-md p-[8.217px] hover:bg-surface-muted">
            <img alt="" src={`${A}/04dda.svg`} className="size-[15.26px]" />
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-md text-fg-strong hover:underline">
              {link.name}
            </a>
            <button
              type="button"
              aria-label={`링크 삭제: ${link.name}`}
              onClick={() => onChange(links.filter((l) => l.id !== link.id))}
              className="flex size-[18px] shrink-0 items-center justify-center rounded-md text-sm text-fg-tertiary hover:bg-surface-chip hover:text-error"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex w-full items-center gap-[6px] rounded-md border border-dashed border-border-strong p-[8px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="이름" size="sm" className="w-[30%]" />
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(false);
            }}
            onKeyDown={onEnter}
            placeholder="https://"
            size="sm"
            invalid={error}
            className="flex-1"
          />
          <button
            type="button"
            onClick={add}
            className="h-[26px] shrink-0 rounded-sm bg-surface-chip px-[8px] text-xs font-medium text-fg-secondary hover:bg-border-strong"
          >
            추가
          </button>
        </div>
        {error ? <p className="text-xs text-error">http(s) 주소를 입력하세요.</p> : null}
      </div>
    </SidePeekSection>
  );
}
