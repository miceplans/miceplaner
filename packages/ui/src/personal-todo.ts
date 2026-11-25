'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

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
 * 메모리 캐시 + useSyncExternalStore로 여러 화면이 같은 목록을 보고,
 * 쓰기는 400ms 지연으로 묶으며 pagehide 때 비운다. 다른 탭이 같은 키를 바꿀 때만 다시 읽는다.
 */

const STORAGE_KEY = 'miceplans.personal-todos';
const SAVE_DELAY = 400;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && ISO_DATE.test(value) ? value : undefined;

/** 저장값을 검증한다. 날짜는 YYYY-MM-DD만 받고, 예전 형식(월 내 날짜 숫자)은 버린다. */
function validTodos(raw: unknown): PersonalTodo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
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

let cache: PersonalTodo[] | null = null;
let saveTimer: number | null = null;
let pendingTodos: PersonalTodo[] | undefined;
const listeners = new Set<() => void>();

const EMPTY: PersonalTodo[] = [];

function load(): PersonalTodo[] {
  if (cache !== null) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw === null ? EMPTY : validTodos(JSON.parse(raw)) ?? EMPTY;
  } catch {
    /* 저장값이 깨져 있으면 빈 목록으로 돌아간다. */
    cache = EMPTY;
  }
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

function write(todos: PersonalTodo[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    /* 저장할 수 없는 환경에서는 세션 동안만 유지한다. */
  }
}

function flush() {
  if (pendingTodos === undefined) return;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = null;
  write(pendingTodos);
  pendingTodos = undefined;
}

function setAll(next: PersonalTodo[]) {
  cache = next;
  pendingTodos = next;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, SAVE_DELAY);
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || event.storageArea !== window.localStorage) return;
    const before = cache;
    cache = null;
    load();
    if (cache !== before) emit();
  });
  window.addEventListener('pagehide', flush);
}

/** 내 할 일 목록과 갱신 함수를 돌려준다. 서버 렌더·hydration 전에는 빈 목록을 본다. */
export function usePersonalTodos(): {
  todos: PersonalTodo[];
  setTodos: (next: PersonalTodo[]) => void;
  updateTodos: (fn: (prev: PersonalTodo[]) => PersonalTodo[]) => void;
} {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const getSnapshot = useCallback(() => cache ?? EMPTY, []);
  const todos = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // hydration 뒤에 저장값을 읽어 반영한다(서버 렌더와 충돌하지 않도록 여기서 처리).
  useEffect(() => {
    const before = cache;
    load();
    if (cache !== before) emit();
  }, []);

  const setTodos = useCallback((next: PersonalTodo[]) => setAll(next), []);
  const updateTodos = useCallback((fn: (prev: PersonalTodo[]) => PersonalTodo[]) => setAll(fn(load())), []);
  return { todos, setTodos, updateTodos };
}
