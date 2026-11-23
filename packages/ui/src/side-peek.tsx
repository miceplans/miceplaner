'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { Input, Textarea } from './field';
import { Select } from './select';
const A = '/assets/schedule';

/** 담당자 미지정 값. Select 옵션 값으로 쓴다. */
const UNASSIGNED = '';

type PeekComponentKey = 'period' | 'place' | 'assignee' | 'agenda' | 'description' | 'clientMemo' | 'tasks' | 'links';
const PEEK_COMPONENTS: { key: PeekComponentKey; label: string }[] = [
  { key: 'period', label: '기간' },
  { key: 'place', label: '장소' },
  { key: 'assignee', label: '담당자' },
  { key: 'agenda', label: '이날의 내 일정' },
  { key: 'description', label: '설명' },
  { key: 'clientMemo', label: '클라이언트 메모' },
  { key: 'tasks', label: '할 일 · 하위 할 일' },
  { key: 'links', label: '관련 링크 및 첨부' },
];
const PEEK_LAYOUT_KEY = 'miceplans.schedule.sidePeekLayout';
const DEFAULT_PEEK_LAYOUT = PEEK_COMPONENTS.map((component) => component.key);

function isPeekComponentKey(value: unknown): value is PeekComponentKey {
  return typeof value === 'string' && PEEK_COMPONENTS.some((component) => component.key === value);
}

function readPeekLayout(): PeekComponentKey[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PEEK_LAYOUT_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return DEFAULT_PEEK_LAYOUT;
    return parsed.filter(isPeekComponentKey).filter((key, index, all) => all.indexOf(key) === index);
  } catch {
    return DEFAULT_PEEK_LAYOUT;
  }
}

/* ---------- 패널 내용 (서버 저장) ---------- */

type SubtaskItem = { id: string; title: string; who: string; done: boolean };
type TaskItem = { id: string; title: string; who: string; subs: SubtaskItem[] };
type LinkItem = { id: string; name: string; url: string };
export type SidePeekContent = { assignees: string[]; description: string; clientMemo: string; tasks: TaskItem[]; links: LinkItem[] };
type PeekContent = SidePeekContent;

const EMPTY_CONTENT: PeekContent = { assignees: [], description: '', clientMemo: '', tasks: [], links: [] };

/**
 * 패널 내용을 읽고 쓰는 저장소. 앱이 서버 API로 구현해 넘긴다.
 * save는 바뀐 필드만 받고, 담당자 version 충돌이면 { conflict: true }를 돌려준다. 그 밖의 실패는 throw한다.
 */
export type SidePeekStore = {
  load: (key: string) => Promise<{ content: SidePeekContent; version: number }>;
  save: (key: string, patch: Partial<SidePeekContent>, baseVersion: number) => Promise<{ conflict: false; version: number } | { conflict: true }>;
};

/** 텍스트 입력은 잠시 멈췄을 때 저장한다. */
const TEXT_SAVE_DELAY = 600;

const newId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** http(s) 링크만 허용한다. 스킴이 없으면 https를 붙인다. */
function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function SidePeekSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[12px]">
      <p className="h-[16.433px] whitespace-nowrap text-md font-bold tracking-[0.4695px] text-fg-strong">{label}</p>
      {children}
    </div>
  );
}

export function SidePeekTextBlock({ children }: { children: string }) {
  return (
    <div className="flex w-full items-center justify-center rounded-md bg-surface-subtle px-[16.433px] py-[12.912px]">
      <p className="w-full text-lg text-fg-strong">{children}</p>
    </div>
  );
}

/** 설명·메모처럼 바로 고쳐 쓰는 여러 줄 입력. */
function SidePeekTextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <SidePeekSection label={label}>
      <Textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        variant="ghost"
        rows={3}
        className="w-full rounded-md bg-surface-subtle px-[16px] py-[12px] text-lg text-fg-strong focus:bg-surface-muted"
      />
    </SidePeekSection>
  );
}

export type AgendaKind = 'todo' | 'program' | 'task' | 'subtask';
export type AgendaItem = { kind: AgendaKind; title: string; meta?: string; done?: boolean };

const AGENDA_GROUPS: { kind: AgendaKind; label: string; badge: string }[] = [
  { kind: 'todo', label: '내 할 일', badge: 'bg-brand-tint text-brand' },
  { kind: 'program', label: '프로그램', badge: 'bg-submit-bg text-submit' },
  { kind: 'task', label: '태스크', badge: 'bg-info-bg text-info' },
  { kind: 'subtask', label: '서브태스크', badge: 'bg-surface-chip text-fg-secondary' },
];

function AgendaSection({ items }: { items: AgendaItem[] }) {
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

/* ---------- 담당자 ---------- */

function AssigneeRow({ assignees, members, onChange }: { assignees: string[]; members: string[]; onChange: (next: string[]) => void }) {
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

function LinksSection({ links, onChange }: { links: LinkItem[]; onChange: (next: LinkItem[]) => void }) {
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

export function SidePeekPanel({
  title,
  date,
  period,
  place,
  agenda,
  members = [],
  storageKey,
  store,
  onClose,
}: {
  title: string;
  date?: string;
  period?: string;
  place?: string;
  agenda?: AgendaItem[];
  /** 담당자로 지정할 수 있는 인력 이름 */
  members?: string[];
  /** 패널 내용을 저장할 키. 없으면 제목과 날짜로 만든다. */
  storageKey?: string;
  /** 패널 내용 저장소. 없으면 화면에서만 편집되고 저장되지 않는다. */
  store?: SidePeekStore;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const contentKey = storageKey ?? `${date ?? ''}|${title}`;
  const [content, setContent] = useState<PeekContent>(EMPTY_CONTENT);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(store ? 'loading' : 'ready');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const versionRef = useRef(0);
  // 아직 서버에 보내지 않은 변경. 키가 바뀌거나 패널이 닫혀도 원래 키로 보낸다.
  const pendingRef = useRef<{ key: string; patch: Partial<PeekContent> } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 저장은 한 번에 하나씩 보내 version이 순서대로 오르게 한다.
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const storeRef = useRef(store);
  storeRef.current = store;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    const target = storeRef.current;
    if (!pending || !target) return;
    pendingRef.current = null;
    setSaveState('saving');
    chainRef.current = chainRef.current.then(async () => {
      try {
        const result = await target.save(pending.key, pending.patch, versionRef.current);
        if (!result.conflict) {
          versionRef.current = result.version;
          setSaveState(pendingRef.current ? 'saving' : 'saved');
          return;
        }
        // 다른 사용자가 먼저 담당자를 바꿨다. 최신 내용을 다시 읽고, 담당자 외 변경은 다시 보낸다.
        const latest = await target.load(pending.key);
        versionRef.current = latest.version;
        const rest = { ...pending.patch };
        delete rest.assignees;
        setContent((prev) => ({ ...prev, assignees: latest.content.assignees }));
        setNotice('다른 사용자가 담당자를 먼저 바꿔 최신 담당자로 갱신했습니다. 필요하면 다시 지정해 주세요.');
        if (Object.keys(rest).length) {
          pendingRef.current = { key: pending.key, patch: { ...rest, ...(pendingRef.current?.key === pending.key ? pendingRef.current.patch : {}) } };
        }
        setSaveState('idle');
        if (pendingRef.current) queueMicrotask(flush);
      } catch {
        // 실패한 변경은 다음 저장에 다시 싣는다.
        const later = pendingRef.current?.key === pending.key ? pendingRef.current.patch : {};
        pendingRef.current = { key: pending.key, patch: { ...pending.patch, ...later } };
        setSaveState('error');
      }
    });
  }, []);

  useEffect(() => {
    if (!store) {
      setContent(EMPTY_CONTENT);
      setLoadState('ready');
      return;
    }
    let alive = true;
    setLoadState('loading');
    setNotice('');
    setSaveState('idle');
    store
      .load(contentKey)
      .then((data) => {
        if (!alive) return;
        versionRef.current = data.version;
        setContent(data.content);
        setLoadState('ready');
      })
      .catch(() => {
        if (alive) setLoadState('error');
      });
    return () => {
      alive = false;
      flush();
    };
  }, [contentKey, store, reloadTick, flush]);

  const patchContent = (patch: Partial<PeekContent>, { debounce = false }: { debounce?: boolean } = {}) => {
    setContent((prev) => ({ ...prev, ...patch }));
    if (!store) return;
    if (patch.assignees) setNotice('');
    const merged = pendingRef.current?.key === contentKey ? pendingRef.current.patch : {};
    if (pendingRef.current && pendingRef.current.key !== contentKey) flush();
    pendingRef.current = { key: contentKey, patch: { ...merged, ...patch } };
    if (timerRef.current) clearTimeout(timerRef.current);
    if (debounce) timerRef.current = setTimeout(flush, TEXT_SAVE_DELAY);
    else flush();
  };
  const [componentOrder, setComponentOrder] = useState<PeekComponentKey[]>(DEFAULT_PEEK_LAYOUT);
  const [editingLayout, setEditingLayout] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<PeekComponentKey | null>(null);
  const [dropTarget, setDropTarget] = useState<PeekComponentKey | null>(null);

  useEffect(() => {
    setComponentOrder(readPeekLayout());
  }, []);

  const saveComponentOrder = (next: PeekComponentKey[]) => {
    setComponentOrder(next);
    try {
      window.localStorage.setItem(PEEK_LAYOUT_KEY, JSON.stringify(next));
    } catch {
      // 저장할 수 없는 브라우저에서는 현재 화면에만 적용한다.
    }
  };

  const reorderComponent = (from: PeekComponentKey, to: PeekComponentKey) => {
    const fromIndex = componentOrder.indexOf(from);
    const toIndex = componentOrder.indexOf(to);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const next = [...componentOrder];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, from);
    saveComponentOrder(next);
  };

  const startComponentDrag = (event: DragEvent<HTMLDivElement>, key: PeekComponentKey) => {
    if (!editingLayout) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
    setDraggedComponent(key);
  };

  const overComponent = (event: DragEvent<HTMLDivElement>, key: PeekComponentKey) => {
    if (!editingLayout) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (key !== draggedComponent) setDropTarget(key);
  };

  const dropComponent = (event: DragEvent<HTMLDivElement>, target: PeekComponentKey) => {
    if (!editingLayout) return;
    event.preventDefault();
    const payload: unknown = event.dataTransfer.getData('text/plain');
    const source = isPeekComponentKey(payload) ? payload : draggedComponent;
    if (source) reorderComponent(source, target);
    setDraggedComponent(null);
    setDropTarget(null);
  };

  const startPointerDrag = (event: PointerEvent<HTMLSpanElement>, key: PeekComponentKey) => {
    if (!editingLayout) return;
    event.preventDefault();
    setDraggedComponent(key);
  };

  const enterPointerDropTarget = (key: PeekComponentKey) => {
    if (!editingLayout || !draggedComponent || draggedComponent === key) return;
    setDropTarget(key);
    reorderComponent(draggedComponent, key);
  };

  const finishPointerDrag = () => {
    setDraggedComponent(null);
    setDropTarget(null);
  };

  const restoreDefaults = () => {
    setComponentOrder(DEFAULT_PEEK_LAYOUT);
    try {
      window.localStorage.removeItem(PEEK_LAYOUT_KEY);
    } catch {
      // 저장할 수 없는 브라우저에서도 기본 구성을 적용한다.
    }
  };

  const renderComponent = (key: PeekComponentKey): ReactNode => {
    switch (key) {
      case 'period':
      case 'place': {
        const value = key === 'period' ? period : place;
        if (!value) return null;
        return (
          <div className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
            <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
              <img alt="" src={`${A}/${key === 'period' ? 'f7145' : '5b17e'}.svg`} className="size-[14.108px]" />
              <span className="whitespace-nowrap">{key === 'period' ? '기간' : '장소'}</span>
            </div>
            <span className="truncate">{value}</span>
          </div>
        );
      }
      case 'assignee':
        return <AssigneeRow assignees={content.assignees} members={members} onChange={(assignees) => patchContent({ assignees })} />;
      case 'agenda': return agenda ? <AgendaSection items={agenda} /> : null;
      case 'description':
        return <SidePeekTextField label="설명" value={content.description} placeholder="설명을 입력하세요" onChange={(description) => patchContent({ description }, { debounce: true })} />;
      case 'clientMemo':
        return <SidePeekTextField label="클라이언트 메모" value={content.clientMemo} placeholder="클라이언트 메모를 입력하세요" onChange={(clientMemo) => patchContent({ clientMemo }, { debounce: true })} />;
      case 'tasks': return <TaskSubtaskSection tasks={content.tasks} members={members} onChange={(tasks) => patchContent({ tasks }, { debounce: true })} />;
      case 'links': return <LinksSection links={content.links} onChange={(links) => patchContent({ links })} />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-transparent" onClick={onClose} aria-hidden />
      <aside
        aria-label="일정 상세"
        className="side-peek-in fixed right-[24px] top-[24px] z-40 flex h-[900px] max-h-[calc(100vh-48px)] w-[540px] max-w-[calc(100vw-48px)] flex-col gap-[28px] rounded-2xl bg-surface p-[44px] leading-[normal] shadow-card max-md:right-[12px] max-md:top-[12px] max-md:h-[calc(100vh-24px)] max-md:max-h-[calc(100vh-24px)] max-md:max-w-[calc(100vw-24px)] max-md:gap-[16px] max-md:p-[24px]"
      >
        <div className="flex w-full shrink-0 items-start gap-[12px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <h2 className="text-3xl font-bold text-fg-strong">{title}</h2>
            {date ? <p className="text-sm text-fg-tertiary">{date}</p> : null}
            {store ? (
              <p role="status" className={`text-xs ${saveState === 'error' ? 'text-error' : 'text-fg-tertiary'}`}>
                {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : null}
                {saveState === 'error' ? (
                  <>
                    저장하지 못했습니다.{' '}
                    <button type="button" onClick={flush} className="underline">
                      다시 시도
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="구성 편집"
            aria-pressed={editingLayout}
            onClick={() => setEditingLayout((editing) => !editing)}
            className={`flex size-[32px] shrink-0 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-chip ${editingLayout ? 'bg-surface-chip' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="2.5" cy="8" r="1.4" />
              <circle cx="8" cy="8" r="1.4" />
              <circle cx="13.5" cy="8" r="1.4" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[32px] overflow-y-auto">
          {notice ? <p role="alert" className="w-full rounded-md bg-surface-subtle px-[12px] py-[8px] text-xs text-fg-secondary">{notice}</p> : null}
          {loadState !== 'ready' ? (
            <div className="flex w-full flex-col items-start gap-[8px] text-sm text-fg-tertiary">
              {loadState === 'loading' ? '불러오는 중…' : (
                <>
                  <span className="text-error">일정 내용을 불러오지 못했습니다.</span>
                  <button type="button" onClick={() => setReloadTick((n) => n + 1)} className="text-xs text-fg-secondary underline">
                    다시 시도
                  </button>
                </>
              )}
            </div>
          ) : (
          <div className="flex w-full flex-col items-start gap-[24px]">
            {componentOrder.map((key) => {
              const component = PEEK_COMPONENTS.find((item) => item.key === key);
              const content = renderComponent(key);
              if (!component || content === null) return null;
              return (
                <div
                  key={key}
                  draggable={editingLayout}
                  onDragStart={(event) => startComponentDrag(event, key)}
                  onDragOver={(event) => overComponent(event, key)}
                  onDrop={(event) => dropComponent(event, key)}
                  onDragEnd={() => { setDraggedComponent(null); setDropTarget(null); }}
                  onPointerEnter={() => enterPointerDropTarget(key)}
                  onPointerUp={finishPointerDrag}
                  onPointerCancel={finishPointerDrag}
                  className={`w-full rounded-md ${editingLayout ? 'border border-dashed p-[8px]' : ''} ${
                    draggedComponent === key ? 'border-brand bg-brand-tint opacity-60' : editingLayout ? 'border-border' : ''
                  } ${dropTarget === key ? 'border-brand bg-brand-tint' : ''}`}
                >
                  {editingLayout ? (
                    <div className="mb-[8px] flex items-center gap-[8px]">
                      <span
                        aria-hidden="true"
                        onPointerDown={(event) => startPointerDrag(event, key)}
                        className="cursor-grab touch-none text-fg-tertiary active:cursor-grabbing"
                      >
                        ⠿
                      </span>
                      <span className="flex-1 text-xs font-medium text-fg-secondary">{component.label}</span>
                      <button
                        type="button"
                        aria-label={`${component.label} 구성요소 삭제`}
                        onClick={() => saveComponentOrder(componentOrder.filter((item) => item !== key))}
                        className="rounded-sm px-[6px] py-[3px] text-xs text-error-delay hover:bg-error-bg"
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                  {content}
                </div>
              );
            })}
            {editingLayout ? (
              <div className="flex w-full flex-col gap-[8px] border-t border-border pt-[12px]">
                <button
                  type="button"
                  onClick={restoreDefaults}
                  className="self-start rounded-sm px-[6px] py-[4px] text-xs text-fg-secondary hover:bg-surface-muted"
                >
                  기본 구성으로 초기화
                </button>
                <p className="m-0 text-xs font-semibold text-fg-secondary">숨긴 구성요소</p>
                {PEEK_COMPONENTS.filter((component) => !componentOrder.includes(component.key)).length ? (
                  <div className="flex flex-wrap gap-[6px]">
                    {PEEK_COMPONENTS.filter((component) => !componentOrder.includes(component.key)).map((component) => (
                      <button
                        key={component.key}
                        type="button"
                        onClick={() => saveComponentOrder([...componentOrder, component.key])}
                        className="rounded-sm border border-border px-[8px] py-[5px] text-xs text-fg hover:bg-surface-muted"
                      >
                        + {component.label}
                      </button>
                    ))}
                  </div>
                ) : <p className="m-0 text-xs text-fg-tertiary">숨긴 구성요소가 없습니다.</p>}
              </div>
            ) : null}
          </div>
          )}
        </div>
        {editingLayout ? (
          <button
            type="button"
            onClick={() => setEditingLayout(false)}
            className="mt-auto flex h-[56px] w-full shrink-0 items-center justify-center rounded-xl bg-surface-muted text-lg font-bold text-fg-strong hover:bg-surface-cell"
          >
            완료
          </button>
        ) : null}
      </aside>
    </>
  );
}
