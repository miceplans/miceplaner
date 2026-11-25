'use client';

import { useEffect, useState } from 'react';
import { createStore, useStore } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';

/**
 * 브라우저 저장소에 보존되는 값 하나를 담는 Zustand 스토어.
 *
 * - 같은 스토어를 쓰는 화면은 같은 값을 본다.
 * - 디스크에는 persist 기본 형식({ state, version })이 아니라 값 그대로 쓴다. 이미 저장된 사용자 데이터와 호환하기 위함이다.
 * - 서버 렌더와 첫 클라이언트 렌더는 항상 기본값이고, 마운트 뒤 저장값을 읽는다(hydration 경고 방지).
 * - 읽기 전에 쓰면 저장값을 먼저 읽어, 기본값이 저장값을 덮어쓰지 않는다.
 * - localStorage 값은 다른 탭이 바꾸면 다시 읽는다.
 */
type Options<T> = {
  key: string;
  /** 저장값을 검증·정규화한다. 저장값이 없거나 깨졌으면 undefined를 받으므로 기본값을 돌려줘야 한다. */
  decode: (raw: unknown) => T;
  /** 서버 렌더와 첫 클라이언트 렌더에 쓰는 값. */
  fallback: T;
  /** 디스크에 쓸 값. undefined면 키를 지운다. 기본은 값 그대로다. */
  encode?: (value: T) => unknown;
  /** 디스크 쓰기 지연(ms). 입력마다 바뀌는 값에 쓴다. 0이면 즉시 쓴다. */
  delay?: number;
  area?: 'local' | 'session';
};

type State<T> = { value: T };
type Update<T> = T | ((prev: T) => T);

/** 지연 중인 쓰기를 비우는 함수들. 페이지를 떠날 때 모두 실행한다. */
const flushers = new Set<() => void>();
let pagehideBound = false;

export function createPersistedStore<T>({ key, decode, fallback, encode = (value) => value, delay = 0, area = 'local' }: Options<T>) {
  const disk = () => (area === 'local' ? window.localStorage : window.sessionStorage);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: State<T> | null = null;

  const flush = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const state = pending;
    pending = null;
    flushers.delete(flush);
    if (!state) return;
    try {
      const raw = encode(state.value);
      if (raw === undefined) disk().removeItem(key);
      else disk().setItem(key, JSON.stringify(raw));
    } catch {
      /* 저장할 수 없는 환경에서는 화면이 떠 있는 동안만 유지한다. */
    }
  };

  const read = (): T => {
    try {
      const raw = disk().getItem(key);
      if (raw !== null) return decode(JSON.parse(raw));
    } catch {
      /* 저장값이 깨져 있으면 기본값으로 돌아간다. */
    }
    return decode(undefined);
  };

  const storage: PersistStorage<State<T>> = {
    getItem: () => ({ state: { value: read() }, version: 0 }),
    setItem: (_name, { state }) => {
      pending = state;
      if (delay === 0) return flush();
      flushers.add(flush);
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    removeItem: () => {},
  };

  const api = createStore<State<T>>()(persist(() => ({ value: fallback }), { name: key, storage, skipHydration: true }));

  // 저장소가 동기라 rehydrate도 호출 즉시 끝난다.
  const hydrate = () => {
    if (!api.persist.hasHydrated()) void api.persist.rehydrate();
  };

  if (typeof window !== 'undefined') {
    if (!pagehideBound) {
      pagehideBound = true;
      window.addEventListener('pagehide', () => flushers.forEach((run) => run()));
    }
    if (area === 'local') {
      window.addEventListener('storage', (event) => {
        // key가 null이면 다른 탭이 저장소를 비운 것이다.
        if ((event.key !== key && event.key !== null) || event.storageArea !== window.localStorage) return;
        // 아직 쓰지 않은 내 변경이 있으면 그 변경이 마지막 저장이 된다.
        if (pending || !api.persist.hasHydrated()) return;
        void api.persist.rehydrate();
      });
    }
  }

  return {
    api,
    hydrate,
    /** 이벤트 처리기에서 현재 값을 읽는다. 렌더 중에는 usePersisted를 쓴다. */
    get: (): T => {
      hydrate();
      return api.getState().value;
    },
    set: (next: Update<T>) => {
      hydrate();
      api.setState((s) => ({ value: typeof next === 'function' ? (next as (prev: T) => T)(s.value) : next }));
    },
  };
}

export type PersistedStore<T> = ReturnType<typeof createPersistedStore<T>>;

/** 행사·표처럼 범위마다 스토어가 필요할 때, 범위당 스토어 하나를 만들어 계속 돌려준다. */
export function scopedStores<S>(create: (scope: string) => S): (scope: string) => S {
  const cache = new Map<string, S>();
  return (scope) => {
    let store = cache.get(scope);
    if (!store) {
      store = create(scope);
      cache.set(scope, store);
    }
    return store;
  };
}

/** 스토어를 구독한다. [값, 갱신 함수, 저장값을 읽었는지]를 돌려준다. */
export function usePersisted<T>(store: PersistedStore<T>): [T, (next: Update<T>) => void, boolean] {
  const value = useStore(store.api, (s) => s.value);
  const [readyStore, setReadyStore] = useState<PersistedStore<T> | null>(null);
  useEffect(() => {
    store.hydrate();
    setReadyStore(store);
  }, [store]);
  return [value, store.set, readyStore === store];
}
