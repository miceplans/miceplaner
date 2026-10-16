'use client';

import { useState } from 'react';
import { FlowTopbar, PageFrame } from '@miceplans/ui';

const A = '/assets/task-board';

type Avatar = '한' | '최' | '박' | '이' | '김';
const AVATAR: Record<Avatar, string> = {
  한: 'bg-notice-bg text-notice',
  최: 'bg-success-bg text-success-deep',
  박: 'bg-info-bg text-brand-blue',
  이: 'bg-surface-chip text-fg-secondary',
  김: 'bg-submit-bg text-brand-soft',
};

type Task = { id: string; event: string; schedule: string; title: string; due: string; late?: boolean; who: Avatar };
type Column = { id: string; name: string; dot: string; done?: boolean; tasks: Task[] };

const COLUMNS: Column[] = [
  {
    id: '할 일',
    name: '할 일',
    dot: 'dot-todo',
    tasks: [
      { id: 't1', event: 'KIMES', schedule: '브로슈어 인쇄', title: '브로슈어 인쇄 견적 3사 비교', due: '03.04', late: true, who: '한' },
      { id: 't2', event: 'KIMES', schedule: '리허설', title: '리허설 장비 체크리스트 작성', due: '03.10', who: '최' },
      { id: 't3', event: 'KIMES', schedule: '행사 당일 운영', title: '스태프 배치도 초안', due: '03.08', who: '박' },
      { id: 't4', event: '파트너스 데이', schedule: '초청장 발송', title: '파트너스 데이 초청 명단 확정', due: '04.01', who: '이' },
    ],
  },
  {
    id: '진행 중',
    name: '진행 중',
    dot: 'dot-progress',
    tasks: [
      { id: 't5', event: 'KIMES', schedule: '디자인 승인', title: 'KIMES 부스 3D 렌더링 수정', due: '03.05', late: true, who: '박' },
      { id: 't6', event: 'AI 서밋', schedule: '홈페이지 오픈', title: 'AI서밋 등록 폼 API 연동', due: '03.12', who: '김' },
      { id: 't7', event: 'KIMES', schedule: '초청장 발송', title: '초청장 수신처 리스트 정리', due: '03.02', who: '최' },
    ],
  },
  {
    id: '검토 대기',
    name: '검토 대기',
    dot: 'dot-review',
    tasks: [
      { id: 't8', event: 'KIMES', schedule: '디자인 승인', title: 'KIMES 메인 키비주얼 v3', due: '03.05', who: '박' },
      { id: 't9', event: 'AI 서밋', schedule: '홈페이지 오픈', title: 'AI서밋 발표 자료 템플릿', due: '03.09', who: '김' },
    ],
  },
  {
    id: '완료',
    name: '완료',
    dot: 'dot-done',
    done: true,
    tasks: [
      { id: 't10', event: 'KIMES', schedule: '홈페이지 오픈', title: 'KIMES 홈페이지 워크플로우 설정', due: '02.20', who: '박' },
      { id: 't11', event: 'KIMES', schedule: '초청장 발송', title: '초청장 디자인 시안 1안', due: '02.26', who: '최' },
      { id: 't12', event: 'KIMES', schedule: '리허설', title: '행사장 실사 예약', due: '02.28', who: '한' },
    ],
  },
];

type EventOption = { name: string; startDate: string; mine: boolean };

const EVENTS: EventOption[] = [
  { name: 'KIMES', startDate: '2026-03-12', mine: true },
  { name: 'AI 서밋', startDate: '2026-05-20', mine: true },
  { name: '파트너스 데이', startDate: '2026-04-15', mine: false },
  { name: '헬스케어 포럼', startDate: '2026-02-03', mine: false },
  { name: '뷰티 엑스포', startDate: '2025-11-08', mine: true },
];

/** 내 행사 우선, 같은 그룹 안에서는 최근 행사 순. */
const SORTED_EVENTS = [...EVENTS].sort(
  (a, b) => Number(b.mine) - Number(a.mine) || b.startDate.localeCompare(a.startDate),
);
const ALL = '전체 행사';

const TABS = [
  { key: 'board', label: 'Board', icon: 'tab-board' },
  { key: 'list', label: 'List', icon: 'tab-list' },
  { key: 'mine', label: '내 Tasks', icon: 'tab-mine' },
] as const;

function TaskCard({ task, done }: { task: Task; done?: boolean }) {
  return (
    <article className="flex h-[100px] w-full shrink-0 flex-col items-start gap-[8px] rounded-md bg-surface p-[12px]">
      <div className="flex items-start gap-[6px]">
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-brand-tint px-[7px] text-2xs font-medium whitespace-nowrap text-brand">
          {task.event}
        </span>
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface-chip px-[7px] text-2xs whitespace-nowrap text-fg-secondary">
          {task.schedule}
        </span>
      </div>
      <p className={`min-w-full text-base font-medium leading-[1.35] ${done ? 'text-fg-secondary' : 'text-fg'}`}>{task.title}</p>
      <div className="flex w-full items-center gap-[6px]">
        <img alt="" src={`${A}/${task.late ? 'due-late' : 'due'}.svg`} className="size-[12px]" />
        <span className={`text-xs whitespace-nowrap ${task.late ? 'text-error-delay' : 'text-fg-secondary'}`}>{task.due}</span>
        {task.late ? <span className="text-2xs font-medium whitespace-nowrap text-error-delay">지연</span> : null}
        <div className="h-px min-w-px flex-1" />
        <span className={`flex size-[22px] items-center justify-center rounded-lg text-2xs font-semibold ${AVATAR[task.who]}`}>
          {task.who}
        </span>
      </div>
    </article>
  );
}

export function TaskBoard() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('board');
  const [columns, setColumns] = useState(COLUMNS);
  const [event, setEvent] = useState(SORTED_EVENTS[0]!.name);
  const [adding, setAdding] = useState<string | null>(null);

  const inEvent = (task: Task) => event === ALL || task.event === event;
  const boardColumns = columns.map((c) => ({ ...c, tasks: c.tasks.filter(inEvent) }));
  const tasks = boardColumns.flatMap((column) => column.tasks.map((task) => ({ ...task, column: column.name, done: column.done })));
  const visibleTasks = tab === 'mine' ? tasks.filter((task) => task.who === '박') : tasks;

  const addTask = (columnId: string, task: Omit<Task, 'id'>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, tasks: [...c.tasks, { ...task, id: `n${Date.now()}` }] } : c)),
    );
    setAdding(null);
  };

  return (
    <PageFrame topbar={<FlowTopbar leading={<EventSelect value={event} onChange={setEvent} />} />}>
      <div role="tablist" className="flex h-[52px] w-full shrink-0 items-center overflow-x-auto border-b border-solid border-border px-[24px] max-md:px-[8px]">
        <div className="flex h-full min-w-max items-start gap-[2px]">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={`flex h-full items-center gap-[7px] px-[12px] text-base whitespace-nowrap ${
                  on ? 'border-b-2 border-solid border-brand font-medium text-brand' : 'text-fg-secondary hover:text-fg'
                }`}
              >
                <img alt="" src={`${A}/${t.icon}.svg`} className="size-[15px]" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {tab === 'board' ? (
        <div className="flex flex-1 items-stretch gap-[16px] overflow-x-auto p-[24px] max-md:p-[12px]">
          {boardColumns.map((c) => (
          <section key={c.id} className="flex w-[276px] shrink-0 flex-col items-start gap-[10px] rounded-lg bg-surface-sidebar p-[10px]">
            <div className="flex h-[26px] w-full items-center gap-[7px]">
              <img alt="" src={`${A}/${c.dot}.svg`} className="size-[8px]" />
              <h2 className="m-0 text-base font-semibold whitespace-nowrap text-fg">{c.name}</h2>
              <span className="flex h-[18px] items-center justify-center rounded-md bg-border-strong px-[6px] text-2xs font-medium text-fg-secondary">
                {c.tasks.length}
              </span>
              <div className="h-px min-w-px flex-1" />
              <button type="button" aria-label={`${c.name} 카드 추가`} onClick={() => setAdding(c.id)} className="flex shrink-0">
                <img alt="" src={`${A}/add.svg`} className="size-[14px]" />
              </button>
            </div>
            {c.tasks.map((t) => (
              <TaskCard key={t.id} task={t} done={c.done} />
            ))}
          </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-[8px] p-[24px] max-md:p-[12px]" role="tabpanel">
          <p className="text-base text-fg-secondary">{tab === 'mine' ? '내가 담당한 Tasks' : '모든 Tasks'}</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[680px]">
              {visibleTasks.map((task) => (
                <div key={task.id} className="flex min-h-[56px] items-center gap-[16px] border-b border-border px-[16px] text-base last:border-b-0">
                  <span className="w-[100px] shrink-0 text-fg-secondary">{task.column}</span>
                  <span className="min-w-0 flex-1 font-medium text-fg">{task.title}</span>
                  <span className="w-[100px] shrink-0 text-fg-secondary">{task.due}</span>
                  <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-lg text-2xs font-semibold ${AVATAR[task.who]}`}>{task.who}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {adding ? (
        <AddTaskDialog
          columnName={columns.find((c) => c.id === adding)?.name ?? ''}
          defaultEvent={event === ALL ? SORTED_EVENTS[0]!.name : event}
          onCancel={() => setAdding(null)}
          onSubmit={(task) => addTask(adding, task)}
        />
      ) : null}
    </PageFrame>
  );
}

function EventSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const item = 'flex w-full items-center gap-[8px] px-[12px] py-[8px] text-left text-base hover:bg-surface-chip';
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[32px] items-center gap-[6px] rounded-sm border border-solid border-border px-[10px] text-base font-semibold whitespace-nowrap text-fg"
      >
        {value}
        <span aria-hidden className="text-2xs text-fg-secondary">▾</span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul role="listbox" className="absolute left-0 top-[36px] z-40 max-h-[320px] w-[240px] overflow-y-auto rounded-md border border-solid border-border bg-surface py-[4px] shadow-card">
            <li>
              <button type="button" role="option" aria-selected={value === ALL} onClick={() => pick(ALL)} className={item}>
                {ALL}
              </button>
            </li>
            {SORTED_EVENTS.map((e, i) => (
              <li key={e.name} className={i > 0 && SORTED_EVENTS[i - 1]!.mine !== e.mine ? 'mt-[4px] border-t border-solid border-border pt-[4px]' : ''}>
                <button type="button" role="option" aria-selected={value === e.name} onClick={() => pick(e.name)} className={`${item} ${value === e.name ? 'text-brand' : 'text-fg'}`}>
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.mine ? <span className="rounded-xs bg-brand-tint px-[6px] text-2xs text-brand">내 행사</span> : null}
                  <span className="text-2xs text-fg-secondary">{e.startDate.slice(2, 7).replace('-', '.')}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function AddTaskDialog({
  columnName,
  defaultEvent,
  onCancel,
  onSubmit,
}: {
  columnName: string;
  defaultEvent: string;
  onCancel: () => void;
  onSubmit: (task: Omit<Task, 'id'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [event, setEvent] = useState(defaultEvent);
  const [schedule, setSchedule] = useState('');
  const [due, setDue] = useState('');
  const [who, setWho] = useState<Avatar>('박');
  const field = 'h-[36px] w-full rounded-sm border border-solid border-border bg-surface px-[10px] text-base text-fg';
  const label = 'flex flex-col gap-[4px] text-sm text-fg-secondary';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-[16px]" onClick={onCancel}>
      <form
        role="dialog"
        aria-label="Task 추가"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const [, m = '', d = ''] = due.split('-');
          onSubmit({ event, schedule: schedule.trim() || '일정 미지정', title: title.trim(), due: due ? `${m}.${d}` : '-', who });
        }}
        className="flex w-[420px] max-w-full flex-col gap-[14px] rounded-lg bg-surface p-[20px] shadow-card"
      >
        <h2 className="m-0 text-lg font-semibold text-fg">Task 추가 · {columnName}</h2>
        <label className={label}>
          제목
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
        <label className={label}>
          행사
          <select value={event} onChange={(e) => setEvent(e.target.value)} className={field}>
            {SORTED_EVENTS.map((e) => (
              <option key={e.name}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          일정
          <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="예: 리허설" className={field} />
        </label>
        <div className="flex gap-[12px]">
          <label className={`${label} flex-1`}>
            마감일
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
          </label>
          <label className={`${label} flex-1`}>
            담당자
            <select value={who} onChange={(e) => setWho(e.target.value as Avatar)} className={field}>
              {(Object.keys(AVATAR) as Avatar[]).map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-[8px]">
          <button type="button" onClick={onCancel} className="h-[32px] rounded-sm border border-solid border-border px-[14px] text-base text-fg-secondary">
            취소
          </button>
          <button type="submit" className="h-[32px] rounded-sm bg-brand px-[14px] text-base font-medium text-fg-inverse">
            추가
          </button>
        </div>
      </form>
    </div>
  );
}
