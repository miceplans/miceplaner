'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { MonthCalendar, usePersonalTodos, type CalendarEvent, type PersonalTodo } from '@miceplans/ui';
import { createPersistedStore, usePersisted } from '@miceplans/ui/persisted-store';
import { getToken } from '../../lib/api';
import { eventItemsList, getEventItemsListQueryKey, useEventsList, useGetMe } from '../../lib/api/generated/endpoints';
import { PersonalTodoDialog } from './personal-todo-dialog';
import { useScheduleNoteStore } from './schedule-note-store';

const LS_TODOS = 'miceplans:schedule-calendar:todo';
const LS_CURSOR = 'miceplans.schedule-calendar.cursor';

type Cursor = { year: number; month: number };

function thisMonth(): Cursor {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** 저장된 커서 월을 읽는다. 유효하지 않으면 이번 달을 쓴다. */
function decodeCursor(raw: unknown): Cursor {
  if (raw && typeof raw === 'object') {
    const { year, month } = raw as { year?: unknown; month?: unknown };
    if (typeof year === 'number' && Number.isInteger(year) && typeof month === 'number' && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return thisMonth();
}

/** 내 할 일 표시 여부. 저장값이 없거나 깨지면 표시한다. */
const todosOnStore = createPersistedStore<boolean>({ key: LS_TODOS, fallback: true, decode: (raw) => raw !== false });
const cursorStore = createPersistedStore<Cursor>({ key: LS_CURSOR, fallback: thisMonth(), decode: decodeCursor });

/**
 * 월간 일정 캘린더. 현재 월을 생성해 보여주며 이전/다음 달 이동은 MonthCalendar가 처리한다.
 * 칩 데이터(행사·작업 일정)는 서버 연동 전까지 없다.
 */
export function ScheduleViewCalendar({
  mine = false,
  gridGap,
  padX,
}: {
  /** 내 일정 탭: 개인 일정 모드로 보여준다 */
  mine?: boolean;
  gridGap?: number;
  padX?: number;
}) {
  const [todosOn, setTodosOn] = usePersisted(todosOnStore);
  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const peekMembers = me.data?.name ? [me.data.name] : [];
  const peekStore = useScheduleNoteStore();

  // 이전/다음 달로 옮긴 커서 월을 저장해 새로고침 후에도 그 월을 보여준다.
  // MonthCalendar는 처음 받은 월만 쓰므로, 저장값을 읽은 뒤 key를 바꿔 다시 시작한다.
  const [cursor, setCursor, cursorReady] = usePersisted(cursorStore);
  const calendarKey = cursorReady ? 'saved' : 'initial';

  const personalTodos = usePersonalTodos();
  const myTasks = useMyTaskTodos(me.data?.id ?? null);
  const [managing, setManaging] = useState(false);
  const todos = todosOn ? [...personalTodos.todos, ...myTasks] : EMPTY_TODOS;
  // 전체 행사의 기간을 달력에 막대로 보여 준다. 할 일과 같은 행사 목록 캐시를 쓴다.
  const eventsQuery = useEventsList(undefined, { query: { enabled: getToken() !== null } });
  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      (eventsQuery.data ?? []).map((ev) => ({
        id: ev.id,
        title: ev.name,
        start: ev.startDate,
        end: ev.endDate,
        color: ev.color,
        href: `/events/detail?id=${ev.id}`,
      })),
    [eventsQuery.data],
  );

  const manageButton = (
    <button
      type="button"
      onClick={() => setManaging(true)}
      className="ml-[6px] flex h-[32px] items-center gap-[6px] rounded-sm border border-solid border-border bg-surface px-[10px] text-sm font-medium text-fg-secondary hover:bg-surface-muted"
    >
      <span className="text-base leading-none">+</span> 할 일
    </button>
  );
  const dialog = managing ? <PersonalTodoDialog todos={personalTodos.todos} onChange={personalTodos.updateTodos} onClose={() => setManaging(false)} /> : null;

  if (mine) {
    return (
      <>
        {dialog}
        <MonthCalendar key={calendarKey} gridGap={gridGap} padX={padX} personal todos={todos} initialMonth={cursor} onMonthChange={setCursor} peekMembers={peekMembers} peekStore={peekStore} headerAddon={manageButton} />
      </>
    );
  }

  return (
    <>
      {dialog}
      <MonthCalendar
        gridGap={gridGap}
        padX={padX}
        todos={todos}
        events={calendarEvents}
        key={calendarKey}
        initialMonth={cursor}
        onMonthChange={setCursor}
        peekMembers={peekMembers}
        peekStore={peekStore}
        headerAddon={
          <>
            <button
              type="button"
              aria-pressed={todosOn}
              onClick={() => setTodosOn((v) => !v)}
              className={`ml-[6px] flex h-[32px] items-center gap-[7px] rounded-sm border border-solid px-[10px] text-sm font-medium ${
                todosOn ? 'border-brand bg-brand-tint text-brand' : 'border-border bg-surface text-fg-secondary hover:bg-surface-muted'
              }`}
            >
              내 할 일 표시
            </button>
            {manageButton}
          </>
        }
      />
    </>
  );
}

const EMPTY_TODOS: PersonalTodo[] = [];

/**
 * 내가 담당인 서버 Task·Subtask 중 완료·취소되지 않고 날짜가 있는 항목을 캘린더용 할 일로 바꾼다.
 * 시작일~마감일이 모두 있으면 기간(빗금 바), 하나만 있으면 그 날짜의 마감 항목으로 표시한다.
 * 할 일 보드와 같은 쿼리 키를 써서 캐시를 공유한다.
 */
function useMyTaskTodos(meId: string | null): PersonalTodo[] {
  const events = useEventsList(undefined, { query: { enabled: meId !== null } });
  const eventList = useMemo(() => events.data ?? [], [events.data]);
  const itemQueries = useQueries({
    queries: eventList.map((ev) => ({
      queryKey: getEventItemsListQueryKey(ev.id),
      queryFn: () => eventItemsList(ev.id),
      staleTime: 30_000,
      enabled: meId !== null,
    })),
  });

  if (meId === null) return EMPTY_TODOS;
  const list: PersonalTodo[] = [];
  eventList.forEach((ev, i) => {
    for (const it of itemQueries[i]?.data ?? []) {
      if (it.kind === 'program' || it.assigneeId !== meId) continue;
      if (it.status === '완료' || it.status === '취소') continue;
      const title = `[${ev.name}] ${it.title}`;
      const id = `task:${it.id}`;
      if (it.startsOn && it.dueOn && it.startsOn < it.dueOn) {
        list.push({ id, title, start: it.startsOn, end: it.dueOn });
      } else if (it.dueOn || it.startsOn) {
        list.push({ id, title, due: (it.dueOn ?? it.startsOn)! });
      }
    }
  });
  return list;
}
