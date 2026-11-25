'use client';

import { createPersistedStore, usePersisted } from './persisted-store';

/** 개인 Todo(내 할 일). 행사 Subtask와 별개이며 본인에게만 보인다. */
export type PersonalTodo = {
  id: string;
  title: string;
  /** 기간 시작일(YYYY-MM-DD). start~end가 있으면 캘린더에 빗금 바로 표시한다 */
  start?: string;
  /** 기간 종료일(YYYY-MM-DD). start와 함께 쓴다 */
  end?: string;
  /** 마감일(YYYY-MM-DD, 기간 미지정). 해당 날짜에 빗금 동그라미 항목으로 표시한다 */
  due?: string;
  done?: boolean;
};

/**
 * 내 할 일(개인 Todo) 저장소. 명세(local-first)대로 서버 동기화 없이 브라우저 localStorage에 둔다.
 * 여러 화면이 같은 목록을 보고, 쓰기는 지연으로 묶는다.
 */

const STORAGE_KEY = 'miceplans.personal-todos';
const SAVE_DELAY = 400;

const EMPTY: PersonalTodo[] = [];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && ISO_DATE.test(value) ? value : undefined;

/** 저장값을 검증한다. 날짜는 YYYY-MM-DD만 받고, 예전 형식(월 내 날짜 숫자)은 버린다. */
function decodeTodos(raw: unknown): PersonalTodo[] {
  if (!Array.isArray(raw)) return EMPTY;
  const list: PersonalTodo[] = [];
  for (const todo of raw) {
    if (!todo || typeof todo !== 'object') continue;
    const candidate = todo as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') continue;
    const start = isoOrUndefined(candidate.start);
    const end = isoOrUndefined(candidate.end);
    const due = isoOrUndefined(candidate.due);
    list.push({
      id: candidate.id,
      title: candidate.title,
      ...(start && end ? { start, end } : {}),
      ...(due ? { due } : {}),
      ...(candidate.done === true ? { done: true } : {}),
    });
  }
  return list;
}

const todoStore = createPersistedStore<PersonalTodo[]>({ key: STORAGE_KEY, fallback: EMPTY, decode: decodeTodos, delay: SAVE_DELAY });

/** 내 할 일 목록과 갱신 함수를 돌려준다. 서버 렌더·hydration 전에는 빈 목록을 본다. */
export function usePersonalTodos(): {
  todos: PersonalTodo[];
  setTodos: (next: PersonalTodo[]) => void;
  updateTodos: (fn: (prev: PersonalTodo[]) => PersonalTodo[]) => void;
} {
  const [todos, setTodos] = usePersisted(todoStore);
  return { todos, setTodos, updateTodos: setTodos };
}
