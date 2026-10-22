'use client';

import { useState } from 'react';
import { Button, ConfirmDialog, Dialog, FlowTopbar, PageFrame, ViewTabs, type ViewTab } from '@miceplans/ui';

const A = '/assets/task-board';

type Avatar = '한' | '최' | '박' | '이' | '김';
/** 목업 현재 사용자. 내 Tasks 필터와 권한 판정의 기준. */
const ME: Avatar = '박';

const AVATAR: Record<Avatar, string> = {
  한: 'bg-notice-bg text-notice',
  최: 'bg-success-bg text-success-deep',
  박: 'bg-info-bg text-brand-blue',
  이: 'bg-surface-chip text-fg-secondary',
  김: 'bg-submit-bg text-brand-soft',
};

/** 이니셜 키에 대응하는 담당자 이름. 카드·목록에는 이름으로 표시한다. */
const AVATAR_NAME: Record<Avatar, string> = { 한: '한지우', 최: '최민준', 박: '박서연', 이: '이준호', 김: '김도현' };

/** 저장 형식은 yyyy-mm-dd. 화면에는 MM.DD로 표시. */
const fmtDue = (due: string | null) => (due ? `${due.slice(5, 7)}.${due.slice(8, 10)}` : '-');

type Task = {
  id: string;
  event: string;
  schedule: string;
  title: string;
  due: string | null;
  late?: boolean;
  who: Avatar;
  createdBy: Avatar;
};
type Column = { id: string; name: string; dot: string; done?: boolean; cancelled?: boolean; tasks: Task[] };

const COLUMNS: Column[] = [
  {
    id: '할 일',
    name: '할 일',
    dot: 'dot-todo',
    tasks: [
      { id: 't1', event: 'KIMES', schedule: '브로슈어 인쇄', title: '브로슈어 인쇄 견적 3사 비교', due: '2026-03-04', late: true, who: '한', createdBy: '박' },
      { id: 't2', event: 'KIMES', schedule: '리허설', title: '리허설 장비 체크리스트 작성', due: '2026-03-10', who: '최', createdBy: '최' },
      { id: 't3', event: 'KIMES', schedule: '행사 당일 운영', title: '스태프 배치도 초안', due: '2026-03-08', who: '박', createdBy: '박' },
      { id: 't4', event: '파트너스 데이', schedule: '초청장 발송', title: '파트너스 데이 초청 명단 확정', due: '2026-04-01', who: '이', createdBy: '박' },
    ],
  },
  {
    id: '진행 중',
    name: '진행 중',
    dot: 'dot-progress',
    tasks: [
      { id: 't5', event: 'KIMES', schedule: '디자인 승인', title: 'KIMES 부스 3D 렌더링 수정', due: '2026-03-05', late: true, who: '박', createdBy: '김' },
      { id: 't6', event: 'AI 서밋', schedule: '홈페이지 오픈', title: 'AI서밋 등록 폼 API 연동', due: null, who: '김', createdBy: '김' },
      { id: 't7', event: 'KIMES', schedule: '초청장 발송', title: '초청장 수신처 리스트 정리', due: '2026-03-02', who: '최', createdBy: '한' },
    ],
  },
  {
    id: '검토 대기',
    name: '검토 대기',
    dot: 'dot-review',
    tasks: [
      { id: 't8', event: 'KIMES', schedule: '디자인 승인', title: 'KIMES 메인 키비주얼 v3', due: '2026-03-05', who: '박', createdBy: '박' },
      { id: 't9', event: 'AI 서밋', schedule: '홈페이지 오픈', title: 'AI서밋 발표 자료 템플릿', due: null, who: '김', createdBy: '김' },
    ],
  },
  {
    id: '보류',
    name: '보류',
    dot: 'dot-hold',
    tasks: [
      { id: 't13', event: 'KIMES', schedule: '디자인 승인', title: '부스 조명 업체 섭외 보류', due: null, who: '최', createdBy: '박' },
      { id: 't14', event: '파트너스 데이', schedule: '초청장 발송', title: '초청장 다국어 번역', due: '2026-04-05', who: '이', createdBy: '이' },
    ],
  },
  {
    id: '취소',
    name: '취소',
    dot: 'dot-cancel',
    cancelled: true,
    tasks: [
      { id: 't15', event: 'KIMES', schedule: '행사 당일 운영', title: '스태프 유니폼 제작', due: '2026-03-06', who: '한', createdBy: '박' },
      { id: 't16', event: '뷰티 엑스포', schedule: '홈페이지 오픈', title: '뷰티 엑스포 사전등록 페이지', due: null, who: '김', createdBy: '김' },
    ],
  },
  {
    id: '완료',
    name: '완료',
    dot: 'dot-done',
    done: true,
    tasks: [
      { id: 't10', event: 'KIMES', schedule: '홈페이지 오픈', title: 'KIMES 홈페이지 워크플로우 설정', due: '2026-02-20', who: '박', createdBy: '박' },
      { id: 't11', event: 'KIMES', schedule: '초청장 발송', title: '초청장 디자인 시안 1안', due: '2026-02-26', who: '최', createdBy: '최' },
      { id: 't12', event: 'KIMES', schedule: '리허설', title: '행사장 실사 예약', due: '2026-02-28', who: '한', createdBy: '박' },
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

type TabKey = 'board' | 'list' | 'mine';

const TABS: (ViewTab & { key: TabKey })[] = [
  { key: 'board', label: 'Board', icon: '/assets/task-board/tab-board.svg' },
  { key: 'list', label: 'List', icon: '/assets/task-board/tab-list.svg' },
  { key: 'mine', label: '내 Tasks', icon: '/assets/task-board/tab-mine.svg' },
];

type SortMode = 'default' | 'due-asc' | 'due-desc';

type TaskFormValues = { title: string; event: string; schedule: string; due: string | null; who: Avatar; status: string };

type DialogState = { mode: 'add'; status: string } | { mode: 'edit'; taskId: string };

function TaskCard({
  task,
  dim,
  strike,
  canEdit,
  canComplete,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: Task;
  dim?: boolean;
  strike?: boolean;
  canEdit: boolean;
  canComplete: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      onDoubleClick={canEdit ? onEdit : undefined}
      className={`flex w-full shrink-0 flex-col items-start gap-[8px] rounded-md bg-surface p-[12px] ${canEdit ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-[6px]">
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-brand-tint px-[7px] text-2xs font-medium whitespace-nowrap text-brand">
          {task.event}
        </span>
        <span className="flex h-[20px] items-center justify-center rounded-xs bg-surface-chip px-[7px] text-2xs whitespace-nowrap text-fg-secondary">
          {task.schedule}
        </span>
      </div>
      <p className={`min-w-full text-base font-medium leading-[1.35] ${dim ? 'text-fg-secondary' : 'text-fg'} ${strike ? 'line-through' : ''}`}>
        {task.title}
      </p>
      <div className="flex w-full items-center gap-[6px]">
        {task.due ? (
          <>
            <img alt="" src={`${A}/${task.late ? 'due-late' : 'due'}.svg`} className="size-[12px]" />
            <span className={`text-xs whitespace-nowrap ${task.late ? 'text-error-delay' : 'text-fg-secondary'}`}>{fmtDue(task.due)}</span>
            {task.late ? <span className="text-2xs font-medium whitespace-nowrap text-error-delay">지연</span> : null}
          </>
        ) : (
          <span className="text-2xs whitespace-nowrap text-fg-secondary">마감일 없음</span>
        )}
        <div className="h-px min-w-px flex-1" />
        <span className={`flex h-[22px] items-center justify-center rounded-lg px-[6px] text-2xs font-semibold whitespace-nowrap ${AVATAR[task.who]}`}>
          {AVATAR_NAME[task.who]}
        </span>
      </div>
      {canEdit || canComplete ? (
        <div className="flex w-full items-center gap-[6px] border-t border-solid border-border pt-[6px]">
          {canComplete ? (
            <button
              type="button"
              onClick={onComplete}
              className="flex h-[20px] items-center rounded-xs bg-brand-tint px-[8px] text-2xs font-medium whitespace-nowrap text-brand hover:opacity-80"
            >
              완료
            </button>
          ) : null}
          <div className="h-px min-w-px flex-1" />
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex h-[20px] items-center rounded-xs bg-surface-chip px-[8px] text-2xs whitespace-nowrap text-fg-secondary hover:text-fg"
              >
                수정
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-[20px] items-center rounded-xs bg-surface-chip px-[8px] text-2xs whitespace-nowrap text-fg-secondary hover:text-error-delay"
              >
                삭제
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function TaskBoard() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('board');
  const [columns, setColumns] = useState(COLUMNS);
  const [event, setEvent] = useState(ALL);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const inEvent = (task: Task) => event === ALL || task.event === event;
  const boardColumns = columns.map((c) => ({ ...c, tasks: c.tasks.filter(inEvent) }));
  const tasks = boardColumns.flatMap((column) =>
    column.tasks.map((task) => ({ ...task, column: column.name, done: column.done, cancelled: column.cancelled })),
  );
  const visibleTasks = tab === 'mine' ? tasks.filter((task) => task.who === ME) : tasks;
  /** 마감일 없는 항목은 어느 방향이든 맨 뒤로. 기본은 현행 순서 유지(안정 정렬). */
  const sortedTasks = [...visibleTasks].sort((a, b) => {
    if (sortMode === 'default') return 0;
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return sortMode === 'due-asc' ? a.due.localeCompare(b.due) : b.due.localeCompare(a.due);
  });

  let editTarget: { task: Task; status: string } | null = null;
  if (dialog?.mode === 'edit') {
    const column = columns.find((c) => c.tasks.some((t) => t.id === dialog.taskId));
    const task = column?.tasks.find((t) => t.id === dialog.taskId);
    if (column && task) editTarget = { task, status: column.id };
  }

  const addTask = (values: TaskFormValues) => {
    const task: Task = { id: `n${Date.now()}`, event: values.event, schedule: values.schedule, title: values.title, due: values.due, who: values.who, createdBy: ME };
    setColumns((prev) => prev.map((c) => (c.id === values.status ? { ...c, tasks: [...c.tasks, task] } : c)));
    setDialog(null);
  };

  const updateTask = (taskId: string, values: TaskFormValues) => {
    setColumns((prev) => {
      const source = prev.find((c) => c.tasks.some((t) => t.id === taskId));
      const existing = source?.tasks.find((t) => t.id === taskId);
      if (!source || !existing) return prev;
      const updated: Task = { ...existing, event: values.event, schedule: values.schedule, title: values.title, due: values.due, who: values.who };
      if (source.id === values.status) {
        return prev.map((c) => (c.id === source.id ? { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? updated : t)) } : c));
      }
      return prev.map((c) => {
        if (c.id === source.id) return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
        if (c.id === values.status) return { ...c, tasks: [...c.tasks, updated] };
        return c;
      });
    });
    setDialog(null);
  };

  /** 담당자 액션: 완료 컬럼으로 이동. */
  const completeTask = (taskId: string) => {
    setColumns((prev) => {
      const source = prev.find((c) => c.tasks.some((t) => t.id === taskId));
      const existing = source?.tasks.find((t) => t.id === taskId);
      const doneCol = prev.find((c) => c.done);
      if (!source || !existing || !doneCol || source.id === doneCol.id) return prev;
      return prev.map((c) => {
        if (c.id === source.id) return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
        if (c.id === doneCol.id) return { ...c, tasks: [...c.tasks, existing] };
        return c;
      });
    });
  };

  const removeTask = (taskId: string) => {
    setColumns((prev) => prev.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })));
    setDeleting(null);
  };

  /** 생성자만 수정 다이얼로그를 연다. */
  const openEdit = (taskId: string) => {
    const task = columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
    if (!task || task.createdBy !== ME) return;
    setDialog({ mode: 'edit', taskId });
  };

  return (
    <PageFrame topbar={<FlowTopbar leading={<EventSelect value={event} onChange={setEvent} />} />}>
      <ViewTabs
        tabs={TABS}
        active={TABS.findIndex((t) => t.key === tab)}
        onChange={(i) => setTab(TABS[i]!.key)}
        bordered
      />
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
              <button type="button" aria-label={`${c.name} 카드 추가`} onClick={() => setDialog({ mode: 'add', status: c.id })} className="flex shrink-0">
                <img alt="" src={`${A}/add.svg`} className="size-[14px]" />
              </button>
            </div>
            {c.tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                dim={c.done || c.cancelled}
                strike={c.cancelled}
                canEdit={t.createdBy === ME}
                canComplete={t.who === ME && !c.done && !c.cancelled}
                onEdit={() => openEdit(t.id)}
                onComplete={() => completeTask(t.id)}
                onDelete={() => setDeleting(t)}
              />
            ))}
          </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-[8px] p-[24px] max-md:p-[12px]" role="tabpanel">
          <div className="flex items-center justify-between gap-[12px]">
            <p className="text-base text-fg-secondary">{tab === 'mine' ? '내가 담당한 Tasks' : '모든 Tasks'}</p>
            <label className="flex items-center gap-[6px] text-sm whitespace-nowrap text-fg-secondary">
              정렬
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="h-[32px] rounded-sm border border-solid border-border bg-surface px-[8px] text-base text-fg">
                <option value="default">기본</option>
                <option value="due-asc">마감일 빠른 순</option>
                <option value="due-desc">마감일 느린 순</option>
              </select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[680px]">
              {sortedTasks.map((task) => (
                <div key={task.id} className="flex min-h-[56px] items-center gap-[16px] border-b border-border px-[16px] text-base last:border-b-0">
                  <span className="w-[100px] shrink-0 text-fg-secondary">{task.column}</span>
                  <span className={`min-w-0 flex-1 font-medium ${task.cancelled ? 'text-fg-secondary line-through' : 'text-fg'}`}>{task.title}</span>
                  <span className={`w-[100px] shrink-0 whitespace-nowrap ${task.late && task.due ? 'text-error-delay' : 'text-fg-secondary'}`}>{fmtDue(task.due)}</span>
                  <span className={`flex h-[22px] shrink-0 items-center justify-center rounded-lg px-[6px] text-2xs font-semibold whitespace-nowrap ${AVATAR[task.who]}`}>{AVATAR_NAME[task.who]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {dialog?.mode === 'add' ? (
        <TaskDialog
          mode="add"
          defaultStatus={dialog.status}
          defaultEvent={event === ALL ? SORTED_EVENTS[0]!.name : event}
          onCancel={() => setDialog(null)}
          onSubmit={addTask}
        />
      ) : null}
      {dialog?.mode === 'edit' && editTarget ? (
        <TaskDialog
          mode="edit"
          initial={{
            title: editTarget.task.title,
            event: editTarget.task.event,
            schedule: editTarget.task.schedule,
            due: editTarget.task.due,
            who: editTarget.task.who,
            status: editTarget.status,
          }}
          defaultEvent={editTarget.task.event}
          onCancel={() => setDialog(null)}
          onSubmit={(values) => updateTask(editTarget.task.id, values)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Task 삭제"
          body={`'${deleting.title}' Task를 삭제할까요? 삭제 후에는 복구할 수 없습니다.`}
          onConfirm={() => removeTask(deleting.id)}
          onClose={() => setDeleting(null)}
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

function TaskDialog({
  mode,
  initial,
  defaultStatus = '할 일',
  defaultEvent,
  onCancel,
  onSubmit,
}: {
  mode: 'add' | 'edit';
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
  const [who, setWho] = useState(initial?.who ?? ME);
  const [status, setStatus] = useState(initial?.status ?? defaultStatus);
  const field = 'h-[36px] w-full rounded-sm border border-solid border-border bg-surface px-[10px] text-base text-fg';
  const label = 'flex flex-col gap-[4px] text-sm text-fg-secondary';
  return (
    <Dialog onClose={onCancel}>
      <form
        role="dialog"
        aria-label={mode === 'add' ? 'Task 추가' : 'Task 수정'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
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
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
        <div className="flex gap-[12px]">
          <label className={`${label} flex-1`}>
            상태
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
              {COLUMNS.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className={`${label} flex-1`}>
            행사
            <select value={event} onChange={(e) => setEvent(e.target.value)} className={field}>
              {SORTED_EVENTS.map((e) => (
                <option key={e.name}>{e.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={label}>
          일정
          <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="예: 리헤설" className={field} />
        </label>
        <div className="flex gap-[12px]">
          <label className={`${label} flex-1`}>
            마감일
            <div className="relative">
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
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
            <select value={who} onChange={(e) => setWho(e.target.value as Avatar)} className={field}>
              {(Object.keys(AVATAR) as Avatar[]).map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-[8px]">
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit">{mode === 'add' ? '추가' : '저장'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
