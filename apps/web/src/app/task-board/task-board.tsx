'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog, FlowTopbar, PageFrame, Select, ViewTabs, toast, type ViewTab } from '@miceplans/ui';
import { getToken, ApiError } from '../../lib/api';
import {
  eventItemsList,
  getEventItemsListQueryKey,
  useDirectoryUsers,
  useEventItemsCreate,
  useEventsList,
  useGetMe,
  useItemsAssign,
  useItemsRemove,
  useItemsReschedule,
  useItemsUpdate,
} from '../../lib/api/generated/endpoints';
import type { EventItemDtoStatus } from '../../lib/api/generated/model';
import {
  ALL,
  DOT_OF,
  ITEM_STATUSES,
  TODAY,
  avatarTone,
  fmtDue,
  loadPrefs,
  savePrefs,
  type Column,
  type DialogState,
  type EventOption,
  type SortMode,
  type Task,
  type TaskFormValues,
} from './task-board-model';
import { TaskCard } from './task-card';
import { EventSelect } from './event-select';
import { TaskDialog } from './task-dialog';

const A = '/assets/task-board';

type TabKey = 'board' | 'list' | 'mine';

const TABS: (ViewTab & { key: TabKey })[] = [
  { key: 'board', label: '보드', icon: '/assets/task-board/tab-board.svg' },
  { key: 'list', label: '목록', icon: '/assets/task-board/tab-list.svg' },
  { key: 'mine', label: '내 할 일', icon: '/assets/task-board/tab-mine.svg' },
];

export function TaskBoard() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('board');
  const [event, setEvent] = useState(ALL);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  // 저장한 필터·정렬은 hydration 이후에 적용해 서버 렌더 결과와 맞춘다.
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.event) setEvent(prefs.event);
    if (prefs.sortMode) setSortMode(prefs.sortMode);
    setPrefsLoaded(true);
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    savePrefs({ event, sortMode });
  }, [event, sortMode, prefsLoaded]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const meId = me.data?.id ?? null;
  const events = useEventsList();
  const users = useDirectoryUsers({ query: { enabled: getToken() !== null, staleTime: 60_000 } });
  const eventList = useMemo(() => events.data ?? [], [events.data]);
  const eventIds = useMemo(() => eventList.map((e) => e.id), [eventList]);
  // 전체 보드는 모든 행사의 할 일을 모아 본다. 행사 수가 적어 행사별 쿼리를 묶는다.
  const itemQueries = useQueries({
    queries: eventIds.map((id) => ({
      queryKey: getEventItemsListQueryKey(id),
      queryFn: () => eventItemsList(id),
      staleTime: 30_000,
    })),
  });

  /** 내 행사 우선, 같은 그룹 안에서는 최근 행사 순. */
  const meName = me.data?.name ?? null;
  const EVENTS: EventOption[] = useMemo(
    () =>
      eventList.map((e) => ({
        id: e.id,
        name: e.name,
        startDate: e.startDate,
        mine: meName ? [e.pmName, e.amName].some((names) => !!names && names.split(',').map((s) => s.trim()).includes(meName)) : false,
      })),
    [eventList, meName],
  );
  const SORTED_EVENTS = useMemo(
    () => [...EVENTS].sort((a, b) => Number(b.mine) - Number(a.mine) || b.startDate.localeCompare(a.startDate)),
    [EVENTS],
  );

  const userNameById = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u.name])), [users.data]);
  const userIdByName = useMemo(() => new Map((users.data ?? []).map((u) => [u.name, u.id])), [users.data]);

  const tasks: Task[] = useMemo(() => {
    const list: Task[] = [];
    itemQueries.forEach((query, i) => {
      const ev = eventList[i];
      if (!ev) return;
      const items = query.data ?? [];
      const titleById = new Map(items.map((it) => [it.id, it.title]));
      for (const it of items) {
        if (it.kind !== 'task') continue;
        list.push({
          id: it.id,
          eventId: ev.id,
          event: ev.name,
          schedule: (it.parentId && titleById.get(it.parentId)) || it.description || '일정 미지정',
          title: it.title,
          due: it.dueOn,
          late: !!it.dueOn && it.dueOn < TODAY && it.status !== '완료' && it.status !== '취소',
          who: it.assigneeId ? (userNameById.get(it.assigneeId) ?? '') : '',
          assigneeId: it.assigneeId,
          createdBy: userNameById.get(it.createdBy) ?? '',
          createdById: it.createdBy,
          status: it.status,
          version: it.version,
        });
      }
    });
    return list;
  }, [itemQueries, eventList, userNameById]);

  const columns: Column[] = useMemo(
    () =>
      ITEM_STATUSES.map((s) => ({
        id: s,
        name: s,
        dot: DOT_OF[s],
        done: s === '완료',
        cancelled: s === '취소',
        tasks: [],
      })),
    [],
  );

  const createItem = useEventItemsCreate();
  const updateItem = useItemsUpdate();
  const assignItem = useItemsAssign();
  const rescheduleItem = useItemsReschedule();
  const removeItem = useItemsRemove();

  const refreshEvent = (eventId: string) =>
    queryClient.invalidateQueries({ queryKey: getEventItemsListQueryKey(eventId) });
  const failToast = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiError ? error.message : fallback);

  const boardColumns = useMemo(
    () => columns.map((c) => ({ ...c, tasks: tasks.filter((t) => t.status === c.id && (event === ALL || t.event === event)) })),
    [columns, tasks, event],
  );
  const visibleTasks = useMemo(
    () =>
      tab === 'mine'
        ? tasks.filter((task) => task.createdById === meId)
        : tasks.filter((task) => event === ALL || task.event === event),
    [tasks, tab, meId, event],
  );
  /** 마감일 없는 항목은 어느 방향이든 맨 뒤로. 기본은 현행 순서 유지(안정 정렬). */
  const sortedTasks = useMemo(
    () =>
      [...visibleTasks].sort((a, b) => {
        if (sortMode === 'default') return 0;
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return sortMode === 'due-asc' ? a.due.localeCompare(b.due) : b.due.localeCompare(a.due);
      }),
    [visibleTasks, sortMode],
  );

  let editTarget: { task: Task; status: string } | null = null;
  if (dialog?.mode === 'edit') {
    const task = tasks.find((t) => t.id === dialog.taskId);
    if (task) editTarget = { task, status: task.status };
  }

  const addTask = (values: TaskFormValues) => {
    const ev = EVENTS.find((e) => e.name === values.event);
    if (!ev) return;
    const schedule = values.schedule.trim();
    createItem.mutate(
      {
        eventId: ev.id,
        data: {
          kind: 'task',
          parentId: null,
          title: values.title,
          description: schedule && schedule !== '일정 미지정' ? schedule : '',
          part: null,
          status: values.status as EventItemDtoStatus,
          startsOn: null,
          dueOn: values.due,
          assigneeId: values.who.trim() ? (userIdByName.get(values.who.trim()) ?? null) : null,
        },
      },
      {
        onSuccess: () => refreshEvent(ev.id),
        onError: (error) => failToast(error, '[500] 할 일 추가에 실패했습니다.'),
      },
    );
    setDialog(null);
  };

  const updateTask = (taskId: string, values: TaskFormValues) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.createdById !== meId) return;
    const schedule = values.schedule.trim();
    const nextAssignee = values.who.trim() ? (userIdByName.get(values.who.trim()) ?? null) : null;
    const onDone = () => refreshEvent(task.eventId);
    updateItem.mutate(
      {
        id: taskId,
        data: {
          title: values.title,
          status: values.status as EventItemDtoStatus,
          description: schedule && schedule !== '일정 미지정' ? schedule : '',
        },
      },
      {
        onSuccess: () => {
          if (nextAssignee !== task.assigneeId) {
            assignItem.mutate({ id: taskId, data: { assigneeId: nextAssignee, expectedVersion: task.version } }, { onSuccess: onDone });
          } else {
            onDone();
          }
        },
        onError: (error) => failToast(error, '[500] 할 일 수정에 실패했습니다.'),
      },
    );
    if (values.due !== task.due) {
      rescheduleItem.mutate({ id: taskId, data: { startsOn: null, dueOn: values.due, expectedVersion: task.version } }, { onError: (error) => failToast(error, '[500] 마감일 변경에 실패했습니다.') });
    }
    setDialog(null);
  };

  /** 담당자 액션: 완료 컬럼으로 이동. */
  const completeTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.assigneeId !== meId || task.status === '완료' || task.status === '취소') return;
    updateItem.mutate(
      { id: taskId, data: { status: '완료' } },
      { onSuccess: () => refreshEvent(task.eventId), onError: (error) => failToast(error, '[500] 완료 처리에 실패했습니다.') },
    );
  };

  const removeTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.createdById !== meId) return;
    removeItem.mutate(
      { id: taskId },
      { onSuccess: () => refreshEvent(task.eventId), onError: (error) => failToast(error, '[500] 삭제에 실패했습니다.') },
    );
    setDeleting(null);
  };

  /** 생성자만 수정 다이얼로그를 연다. */
  const openEdit = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.createdById !== meId) return;
    setDialog({ mode: 'edit', taskId });
  };

  return (
    <PageFrame topbar={<FlowTopbar leading={<EventSelect value={event} onChange={setEvent} events={SORTED_EVENTS} />} />}>
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
                canEdit={t.createdById === meId}
                canComplete={t.assigneeId === meId && !c.done && !c.cancelled}
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
            <p className="text-base text-fg-secondary">{tab === 'mine' ? '내가 작성한 Tasks' : '모든 Tasks'}</p>
            <label className="flex items-center gap-[6px] text-sm whitespace-nowrap text-fg-secondary">
              정렬
              <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="shrink-0">
                <option value="default">기본</option>
                <option value="due-asc">마감일 빠른 순</option>
                <option value="due-desc">마감일 느린 순</option>
              </Select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[680px]">
              {sortedTasks.map((task) => (
                <div key={task.id} className="flex min-h-[56px] items-center gap-[16px] border-b border-border px-[16px] text-base last:border-b-0">
                  <span className="w-[100px] shrink-0 text-fg-secondary">{task.status}</span>
                  <span className={`min-w-0 flex-1 font-medium ${task.status === '취소' ? 'text-fg-secondary line-through' : 'text-fg'}`}>{task.title}</span>
                  <span className={`w-[100px] shrink-0 whitespace-nowrap ${task.late && task.due ? 'text-error-delay' : 'text-fg-secondary'}`}>{fmtDue(task.due)}</span>
                  <span className={`flex h-[22px] shrink-0 items-center justify-center rounded-lg px-[6px] text-2xs font-semibold whitespace-nowrap ${avatarTone(task.who || '?')}`}>{task.who || '미배정'}</span>
                </div>
              ))}
              {!sortedTasks.length && <p className="m-0 px-[16px] py-[20px] text-base text-fg-tertiary">표시할 할 일이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
      {dialog?.mode === 'add' ? (
        <TaskDialog
          mode="add"
          columns={columns}
          events={SORTED_EVENTS}
          defaultStatus={dialog.status}
          defaultEvent={event === ALL ? (SORTED_EVENTS[0]?.name ?? '') : event}
          onCancel={() => setDialog(null)}
          onSubmit={addTask}
        />
      ) : null}
      {dialog?.mode === 'edit' && editTarget ? (
        <TaskDialog
          mode="edit"
          columns={columns}
          events={SORTED_EVENTS}
          initial={{
            title: editTarget.task.title,
            event: editTarget.task.event,
            schedule: editTarget.task.schedule === '일정 미지정' ? '' : editTarget.task.schedule,
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
          title="할 일 삭제"
          body={`'${deleting.title}' 할 일을 삭제할까요? 삭제 후에는 복구할 수 없습니다.`}
          onConfirm={() => removeTask(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </PageFrame>
  );
}
