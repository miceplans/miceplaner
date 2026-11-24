'use client';

import { useEffect, useState } from 'react';
import { MonthCalendar, usePersonalTodos } from '@miceplans/ui';
import { getToken } from '../../lib/api';
import { useGetMe } from '../../lib/api/generated/endpoints';
import { useScheduleNoteStore } from './schedule-note-store';

const LS_TODOS = 'miceplans:schedule-calendar:todo';
const LS_CURSOR = 'miceplans.schedule-calendar.cursor';

/** 저장된 내 할 일 표시 여부를 읽는다. 저장값이 없거나 깨지면 표시한다. */
function loadTodoPref(): boolean {
  try {
    const raw = window.localStorage.getItem(LS_TODOS);
    if (raw) return JSON.parse(raw) !== false;
  } catch {
    // 깨진 저장값은 무시하고 기본값(표시)을 쓴다
  }
  return true;
}

/** 저장된 커서 월을 읽는다. 유효하지 않으면 이번 달을 쓴다. */
function loadCursor(): { year: number; month: number } {
  try {
    const raw = window.localStorage.getItem(LS_CURSOR);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      const { year, month } = parsed as { year?: unknown; month?: unknown };
      if (typeof year === 'number' && Number.isInteger(year) && typeof month === 'number' && month >= 1 && month <= 12) {
        return { year, month };
      }
    }
  } catch {
    // 깨진 저장값은 무시한다
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

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
  const [todosOn, setTodosOn] = useState(true);
  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const peekMembers = me.data?.name ? [me.data.name] : [];
  const peekStore = useScheduleNoteStore();

  /* 새로고침 후에도 표시 설정을 유지한다 (hydration 직후 저장값 적용) */
  useEffect(() => {
    setTodosOn(loadTodoPref());
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_TODOS, JSON.stringify(todosOn));
    } catch {
      // 저장 실패는 무시한다
    }
  }, [todosOn]);

  // 이전/다음 달로 옮긴 커서 월을 저장해 새로고침 후에도 그 월을 보여준다.
  // 첫 렌더는 서버 결과와 맞추고, hydration 뒤 저장값을 적용한다.
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  useEffect(() => {
    setCursor(loadCursor());
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_CURSOR, JSON.stringify(cursor));
    } catch {
      // 저장 실패는 무시한다
    }
  }, [cursor]);

  const personalTodos = usePersonalTodos();
  const todos = todosOn ? personalTodos.todos : [];
  if (mine) {
    return <MonthCalendar gridGap={gridGap} padX={padX} personal todos={todos} initialMonth={cursor} onMonthChange={setCursor} peekMembers={peekMembers} peekStore={peekStore} />;
  }

  return (
    <MonthCalendar
      gridGap={gridGap}
      padX={padX}
      todos={todos}
      initialMonth={cursor}
      onMonthChange={setCursor}
      peekMembers={peekMembers}
      peekStore={peekStore}
      headerAddon={
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
      }
    />
  );
}
