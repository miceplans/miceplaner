'use client';

import { useEffect, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { Input, Select } from './field';

const A = '/assets/schedule';

const PROPS = [
  { icon: 'f7145', label: '기간', value: '6월 13일 (금) · 오후 2:00 ~ 오후 3:30' },
  { icon: '5b17e', label: '장소', value: '메인 스테이지 · 음향 감독 구역' },
] as const;

const LINKS = [
  { icon: '04dda', name: '사운드 세팅 시트', meta: 'Google Sheets' },
  { icon: '7197f', name: '스테이지 도면.pdf', meta: '2.4 MB' },
] as const;

const MEMO = '메인 스테이지 전체 사운드 밸런싱 작업입니다. 음향 업체와 협의한 세팅 시트를 참고해 진행하세요.';

type PeekComponentKey = 'period' | 'place' | 'assignee' | 'agenda' | 'description' | 'clientMemo' | 'tasks' | 'links';
const PEEK_COMPONENTS: { key: PeekComponentKey; label: string }[] = [
  { key: 'period', label: '기간' },
  { key: 'place', label: '장소' },
  { key: 'assignee', label: '담당자' },
  { key: 'agenda', label: '이날의 내 일정' },
  { key: 'description', label: '설명' },
  { key: 'clientMemo', label: '클라이언트 메모' },
  { key: 'tasks', label: 'Task · Subtask' },
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

/* ---------- Task · Subtask 지정 ---------- */

type AssigneeKey = '한' | '최' | '박' | '이' | '김';

const ASSIGNEE: Record<AssigneeKey, { name: string }> = {
  한: { name: '한지우' },
  최: { name: '최민준' },
  박: { name: '박서연' },
  이: { name: '이준호' },
  김: { name: '김도현' },
};

type SubtaskItem = { id: string; title: string; who: AssigneeKey; done: boolean };
type TaskItem = { id: string; title: string; who: AssigneeKey; subs: SubtaskItem[] };

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    title: '장비 세팅',
    who: '최',
    subs: [
      { id: 'sub-1', title: '스피커 배치 확인', who: '한', done: true },
      { id: 'sub-2', title: '믹싱 콘솔 테스트', who: '최', done: false },
    ],
  },
  {
    id: 'task-2',
    title: '리허설 준비',
    who: '박',
    subs: [{ id: 'sub-3', title: '리허설 순서표 작성', who: '박', done: false }],
  },
];

function AssigneeAvatar({ who, size = 'md' }: { who: AssigneeKey; size?: 'md' | 'sm' }): React.ReactNode {
  const cls = size === 'sm' ? 'text-2xs' : 'text-xs';
  return (
    <span aria-label={ASSIGNEE[who].name} className={`whitespace-nowrap text-fg-secondary ${cls}`}>
      {ASSIGNEE[who].name}
    </span>
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

/** 일정 상세에서 Task와 Subtask를 지정·관리하는 섹션. */
export function TaskSubtaskSection(): React.ReactNode {
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskWho, setTaskWho] = useState<AssigneeKey>('박');
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [subWhos, setSubWhos] = useState<Record<string, AssigneeKey>>({});

  const addTask = (): void => {
    const title = taskDraft.trim();
    if (!title) return;
    setTasks((prev) => [...prev, { id: `task-${Date.now()}`, title, who: taskWho, subs: [] }]);
    setTaskDraft('');
  };

  const removeTask = (taskId: string): void => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const addSub = (taskId: string): void => {
    const title = (subDrafts[taskId] ?? '').trim();
    if (!title) return;
    const task = tasks.find((t) => t.id === taskId);
    const who = subWhos[taskId] ?? task?.who ?? '박';
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, subs: [...t.subs, { id: `sub-${Date.now()}`, title, who, done: false }] } : t)),
    );
    setSubDrafts((prev) => ({ ...prev, [taskId]: '' }));
  };

  const toggleSub = (taskId: string, subId: string): void => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, subs: t.subs.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) } : t)),
    );
  };

  const removeSub = (taskId: string, subId: string): void => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subs: t.subs.filter((s) => s.id !== subId) } : t)));
  };

  const doneCount = tasks.reduce((n, t) => n + t.subs.filter((s) => s.done).length, 0);
  const totalCount = tasks.reduce((n, t) => n + t.subs.length, 0);

  const selectCls = 'shrink-0';
  const draftInputCls = 'flex-1';

  return (
    <div className="flex w-full flex-col gap-[12px]">
      <div className="flex items-center gap-[8px]">
        <p className="whitespace-nowrap text-md font-bold tracking-[0.4695px] text-fg-strong">Task · Subtask</p>
        <span className="flex h-[18px] items-center justify-center rounded-md bg-border-strong px-[6px] text-2xs font-medium text-fg-secondary">
          {doneCount}/{totalCount}
        </span>
      </div>
      <div className="flex w-full flex-col gap-[8px]">
        {tasks.map((task) => (
          <div key={task.id} className="flex w-full flex-col gap-[6px] rounded-md bg-surface-subtle p-[10px]">
            <div className="flex w-full items-center gap-[8px]">
              <span className="min-w-0 flex-1 truncate text-md font-bold text-fg-strong">{task.title}</span>
              <span className="whitespace-nowrap text-xs text-fg-secondary">{ASSIGNEE[task.who].name}</span>
              <button
                type="button"
                aria-label={`Task 삭제: ${task.title}`}
                onClick={() => removeTask(task.id)}
                className="flex size-[18px] shrink-0 items-center justify-center rounded-md text-sm text-fg-tertiary hover:bg-surface-chip hover:text-error"
              >
                ✕
              </button>
            </div>
            <div className="flex w-full flex-col gap-[2px]">
              {task.subs.map((sub) => (
                <div key={sub.id} className="flex w-full items-center gap-[8px] rounded-sm px-[4px] py-[3px] hover:bg-surface">
                  <SubtaskCheck done={sub.done} onToggle={() => toggleSub(task.id, sub.id)} />
                  <span className={`min-w-0 flex-1 truncate text-md ${sub.done ? 'text-fg-tertiary line-through' : 'text-fg'}`}>{sub.title}</span>
                  <AssigneeAvatar who={sub.who} size="sm" />
                  <button
                    type="button"
                    aria-label={`Subtask 삭제: ${sub.title}`}
                    onClick={() => removeSub(task.id, sub.id)}
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
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSub(task.id);
                    }
                  }}
                  placeholder="Subtask 추가"
                  variant="ghost"
                  className="flex-1 text-md"
                />
                <Select
                  value={subWhos[task.id] ?? task.who}
                  onChange={(e) => setSubWhos((prev) => ({ ...prev, [task.id]: e.target.value as AssigneeKey }))}
                  aria-label="Subtask 담당자"
                  size="sm"
                  className={selectCls}
                >
                  {(Object.keys(ASSIGNEE) as AssigneeKey[]).map((a) => (
                    <option key={a} value={a}>
                      {ASSIGNEE[a].name}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => addSub(task.id)}
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
              if (e.key === 'Enter') {
                e.preventDefault();
                addTask();
              }
            }}
            placeholder="Task 추가"
            size="sm"
            className={draftInputCls}
          />
          <Select
            value={taskWho}
            onChange={(e) => setTaskWho(e.target.value as AssigneeKey)}
            aria-label="Task 담당자"
            size="sm"
            className={selectCls}
          >
            {(Object.keys(ASSIGNEE) as AssigneeKey[]).map((a) => (
              <option key={a} value={a}>
                {ASSIGNEE[a].name}
              </option>
            ))}
          </Select>
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

export function SidePeekPanel({
  title,
  date,
  period,
  place,
  agenda,
  onClose,
}: {
  title: string;
  date?: string;
  period?: string;
  place?: string;
  agenda?: AgendaItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const props = PROPS.map((p) => (p.label === '기간' && period ? { ...p, value: period } : p.label === '장소' && place ? { ...p, value: place } : p));
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
        const property = props.find((item) => item.label === (key === 'period' ? '기간' : '장소'));
        return property ? (
          <div className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
            <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
              <img alt="" src={`${A}/${property.icon}.svg`} className="size-[14.108px]" />
              <span className="whitespace-nowrap">{property.label}</span>
            </div>
            <span className="whitespace-nowrap">{property.value}</span>
          </div>
        ) : null;
      }
      case 'assignee':
        return (
          <div className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
            <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
              <img alt="" src={`${A}/dd62d.svg`} className="size-[14.108px]" />
              <span className="whitespace-nowrap">담당자</span>
            </div>
            <div className="flex items-center gap-[8px]">
              <div className="flex items-center gap-[4px]">
                <span className="whitespace-nowrap">민준</span>
              </div>
              <button type="button" aria-label="담당자 추가" className="flex size-[18.81px] items-center justify-center rounded-md hover:bg-surface-chip">
                <img alt="" src={`${A}/1d729.svg`} className="size-[9.405px]" />
              </button>
            </div>
          </div>
        );
      case 'agenda': return agenda ? <AgendaSection items={agenda} /> : null;
      case 'description':
        return <SidePeekSection label="설명"><SidePeekTextBlock>{MEMO}</SidePeekTextBlock></SidePeekSection>;
      case 'clientMemo':
        return <SidePeekSection label="클라이언트 메모"><SidePeekTextBlock>{MEMO}</SidePeekTextBlock></SidePeekSection>;
      case 'tasks': return <TaskSubtaskSection />;
      case 'links':
        return (
          <SidePeekSection label="관련 링크 및 첨부">
            <div className="flex w-full flex-col gap-[2px]">
              {LINKS.map((link) => (
                <a key={link.name} href="#" className="flex w-full items-center gap-[10.564px] rounded-md p-[8.217px] hover:bg-surface-muted">
                  <img alt="" src={`${A}/${link.icon}.svg`} className="size-[15.26px]" />
                  <span className="whitespace-nowrap text-md text-fg-strong">{link.name}</span>
                  <span className="h-[1.174px] min-w-px flex-1" />
                  <span className="whitespace-nowrap text-sm text-fg-tertiary">{link.meta}</span>
                </a>
              ))}
            </div>
          </SidePeekSection>
        );
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
