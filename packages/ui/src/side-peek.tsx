'use client';

import { useEffect, useState } from 'react';

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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[12px]">
      <p className="h-[16.433px] whitespace-nowrap text-md font-bold tracking-[0.4695px] text-fg-strong">{label}</p>
      {children}
    </div>
  );
}

function TextBlock({ children }: { children: string }) {
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
    <Section label="이날의 내 일정">
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
    </Section>
  );
}

/* ---------- Task · Subtask 지정 ---------- */

type AssigneeKey = '한' | '최' | '박' | '이' | '김';

const ASSIGNEE: Record<AssigneeKey, { cls: string; name: string }> = {
  한: { cls: 'bg-notice-bg text-notice', name: '한지우' },
  최: { cls: 'bg-success-bg text-success-deep', name: '최민준' },
  박: { cls: 'bg-info-bg text-brand-blue', name: '박서연' },
  이: { cls: 'bg-surface-chip text-fg-secondary', name: '이준호' },
  김: { cls: 'bg-submit-bg text-brand-soft', name: '김도현' },
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
  const cls = size === 'sm' ? 'size-[18px]' : 'size-[20.691px]';
  return (
    <span aria-label={ASSIGNEE[who].name} className={`flex ${cls} shrink-0 items-center justify-center rounded-lg text-2xs font-semibold ${ASSIGNEE[who].cls}`}>
      {who}
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

  const selectCls = 'h-[26px] shrink-0 rounded-sm border border-solid border-border bg-surface px-[6px] text-xs text-fg-secondary';
  const draftInputCls =
    'h-[26px] min-w-0 flex-1 rounded-sm border border-solid border-border bg-surface px-[8px] text-md text-fg outline-none placeholder:text-fg-tertiary';
  const inlineInputCls = 'min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-tertiary';

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
              <AssigneeAvatar who={task.who} />
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
                <input
                  value={subDrafts[task.id] ?? ''}
                  onChange={(e) => setSubDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSub(task.id);
                    }
                  }}
                  placeholder="Subtask 추가"
                  className={inlineInputCls}
                />
                <select
                  value={subWhos[task.id] ?? task.who}
                  onChange={(e) => setSubWhos((prev) => ({ ...prev, [task.id]: e.target.value as AssigneeKey }))}
                  aria-label="Subtask 담당자"
                  className={selectCls}
                >
                  {(Object.keys(ASSIGNEE) as AssigneeKey[]).map((a) => (
                    <option key={a} value={a}>
                      {ASSIGNEE[a].name}
                    </option>
                  ))}
                </select>
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
          <input
            value={taskDraft}
            onChange={(e) => setTaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTask();
              }
            }}
            placeholder="Task 추가"
            className={draftInputCls}
          />
          <select value={taskWho} onChange={(e) => setTaskWho(e.target.value as AssigneeKey)} aria-label="Task 담당자" className={selectCls}>
            {(Object.keys(ASSIGNEE) as AssigneeKey[]).map((a) => (
              <option key={a} value={a}>
                {ASSIGNEE[a].name}
              </option>
            ))}
          </select>
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

  return (
    <>
      <div className="fixed inset-0 z-30 bg-transparent" onClick={onClose} aria-hidden />
      <aside
        aria-label="일정 상세"
        className="side-peek-in fixed right-[24px] top-[96px] z-40 flex h-[694px] max-h-[calc(100vh-112px)] w-[498px] max-w-full flex-col gap-[24px] rounded-2xl bg-surface p-[40px] leading-[normal] shadow-card"
      >
        <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[32px] overflow-y-auto">
          <div className="flex flex-col gap-[4px]">
            <h2 className="text-3xl font-bold text-fg-strong">{title}</h2>
            {date ? <p className="text-sm text-fg-tertiary">{date}</p> : null}
          </div>
          <div className="flex w-full flex-col items-start gap-[24px]">
            <div className="flex flex-col gap-[1.379px]">
              {props.map((p) => (
                <div key={p.label} className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
                  <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
                    <img alt="" src={`${A}/${p.icon}.svg`} className="size-[14.108px]" />
                    <span className="whitespace-nowrap">{p.label}</span>
                  </div>
                  <span className="whitespace-nowrap">{p.value}</span>
                </div>
              ))}
              <div className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
                <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
                  <img alt="" src={`${A}/dd62d.svg`} className="size-[14.108px]" />
                  <span className="whitespace-nowrap">담당자</span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <div className="flex items-center gap-[4px]">
                    <span className="flex size-[20.691px] items-center justify-center rounded-lg bg-success-solid text-2xs font-bold text-fg-inverse">MN</span>
                    <span className="whitespace-nowrap">민준</span>
                  </div>
                  <button type="button" aria-label="담당자 추가" className="flex size-[18.81px] items-center justify-center rounded-md hover:bg-surface-chip">
                    <img alt="" src={`${A}/1d729.svg`} className="size-[9.405px]" />
                  </button>
                </div>
              </div>
            </div>
            {agenda ? <AgendaSection items={agenda} /> : null}
            <Section label="설명">
              <TextBlock>{MEMO}</TextBlock>
            </Section>
            <Section label="클라이언트 메모">
              <TextBlock>{MEMO}</TextBlock>
            </Section>
            <TaskSubtaskSection />
            <Section label="관련 링크 및 첨부">
              <div className="flex w-full flex-col gap-[2px]">
                {LINKS.map((l) => (
                  <a key={l.name} href="#" className="flex w-full items-center gap-[10.564px] rounded-md p-[8.217px] hover:bg-surface-muted">
                    <img alt="" src={`${A}/${l.icon}.svg`} className="size-[15.26px]" />
                    <span className="whitespace-nowrap text-md text-fg-strong">{l.name}</span>
                    <span className="h-[1.174px] min-w-px flex-1" />
                    <span className="whitespace-nowrap text-sm text-fg-tertiary">{l.meta}</span>
                  </a>
                ))}
              </div>
            </Section>
          </div>
        </div>
        <button type="button" className="mt-auto flex h-[56px] w-full shrink-0 items-center justify-center rounded-xl bg-surface-muted text-lg font-bold text-fg-strong hover:bg-surface-cell">
          편집
        </button>
      </aside>
    </>
  );
}
