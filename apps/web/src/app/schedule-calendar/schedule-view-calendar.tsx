'use client';

import { useEffect, useState } from 'react';
import { MonthCalendar, PERSONAL_TODOS } from '@miceplans/ui';

const LS_TODOS = 'miceplans:schedule-calendar:todo';

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

  const todos = todosOn ? PERSONAL_TODOS : [];
  if (mine) {
    return <MonthCalendar gridGap={gridGap} padX={padX} personal todos={todos} />;
  }

  return (
    <MonthCalendar
      gridGap={gridGap}
      padX={padX}
      todos={todos}
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
