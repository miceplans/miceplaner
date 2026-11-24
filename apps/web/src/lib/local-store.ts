'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * localStorage를 반응형 스토어로 쓰는 작은 유틸.
 *
 * - 메모리 캐시를 먼저 응답해 키 입력마다 디스크를 읽지 않는다.
 * - useSyncExternalStore로 여러 인스턴스가 같은 값을 본다(같은 키는 저장소를 공유한다).
 * - 저장은 기본 400ms 지연으로 묶고, pagehide 때 모두 비운다.
 * - 다른 탭이 같은 키를 바꿀 때만 storage 이벤트로 다시 읽는다.
 *
 * 서버 렌더와 첫 클라이언트 렌더는 항상 기본값으로 맞춰 hydration 경고가 나지 않고,
 * 마운트 뒤 저장값을 읽어 반영한다.
 */

export type LocalStore<T> = {
  readonly key: string;
  /** 메모리 캐시의 현재 값. 아직 읽기 전이면 기본값이다. */
  get: () => T;
  /** 메모리를 즉시 바꾸고 화면에 알리며, 디스크 쓰기는 지연한다. */
  set: (next: T) => void;
  update: (fn: (prev: T) => T) => void;
  /** 지연 중인 쓰기를 즉시 디스크에 옮긴다. */
  flush: () => void;
  /** 첫 마운트 뒤 디스크 저장값을 읽어 반영한다. 이미 읽었으면 아무 일도 하지 않는다. */
  hydrate: () => void;
  subscribe: (listener: () => void) => () => void;
};

type Options<T> = {
  key: string;
  fallback: T;
  /** 저장값을 검증·정규화한다. 유효하지 않으면 undefined를 돌려 기본값으로 돌아간다. */
  validate?: (raw: unknown) => T | undefined;
  /** 디스크 쓰기 지연(ms). 0이면 즉시 쓴다. */
  delay?: number;
};

const DEFAULT_DELAY = 400;

const storeCache = new Map<string, LocalStore<unknown>>();
const pendingStores = new Set<LocalStore<unknown>>();
let pagehideBound = false;

function flushPendingStores() {
  for (const store of pendingStores) store.flush();
}

export function createLocalStore<T>({ key, fallback, validate, delay = DEFAULT_DELAY }: Options<T>): LocalStore<T> {
  let cache: T | undefined;
  let cacheLoaded = false;
  let pendingTimer: number | null = null;
  let pendingValue: T | undefined;
  const listeners = new Set<() => void>();

  const normalize = (raw: unknown): T => {
    const value = validate ? validate(raw) : (raw as T);
    return value === undefined ? fallback : value;
  };

  const load = (): T => {
    if (!cacheLoaded) {
      try {
        const raw = window.localStorage.getItem(key);
        cache = raw === null ? fallback : normalize(JSON.parse(raw));
      } catch {
        /* 저장값이 깨져 있으면 기본값으로 돌아간다. */
        cache = fallback;
      }
      cacheLoaded = true;
    }
    return cache as T;
  };

  const clearPending = () => {
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };

  const store: LocalStore<T> = {
    key,
    get: () => (cacheLoaded ? (cache as T) : fallback),
    set: (next) => {
      cache = next;
      cacheLoaded = true;
      if (delay === 0) {
        clearPending();
        pendingValue = undefined;
        writeDisk(next);
      } else {
        pendingValue = next;
        clearPending();
        pendingTimer = window.setTimeout(() => {
          pendingTimer = null;
          if (pendingValue !== undefined) {
            writeDisk(pendingValue);
            pendingValue = undefined;
            pendingStores.delete(store as LocalStore<unknown>);
          }
        }, delay);
        pendingStores.add(store as LocalStore<unknown>);
      }
      emit();
    },
    update: (fn) => store.set(fn(load())),
    flush: () => {
      if (pendingValue === undefined) return;
      clearPending();
      writeDisk(pendingValue);
      pendingValue = undefined;
      pendingStores.delete(store as LocalStore<unknown>);
    },
    hydrate: () => {
      if (cacheLoaded) return;
      const before = store.get();
      load();
      if (!Object.is(before, cache)) emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  const emit = () => {
    for (const listener of listeners) listener();
  };

  function writeDisk(value: T) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장할 수 없는 환경에서는 세션 동안만 유지한다. */
    }
  }

  // 다른 탭이 같은 키를 바꿨을 때만 다시 읽는다.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key || event.storageArea !== window.localStorage) return;
      cacheLoaded = false;
      load();
      emit();
    });
    if (!pagehideBound) {
      pagehideBound = true;
      window.addEventListener('pagehide', flushPendingStores);
    }
  }

  return store;
}

/** 같은 key의 저장소를 계속 돌려준다. 페이지 안의 여러 인스턴스가 하나의 캐시를 공유하게 한다. */
export function getLocalStore<T>(options: Options<T>): LocalStore<T> {
  const cached = storeCache.get(options.key);
  if (cached) return cached as LocalStore<T>;
  const store = createLocalStore(options);
  storeCache.set(options.key, store as LocalStore<unknown>);
  return store;
}

/** 저장소의 현재 값을 구독한다. 마운트 뒤에 디스크 저장값을 읽어 반영한다. */
export function useLocalStore<T>(store: LocalStore<T>): T {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getSnapshot = useCallback(() => store.get(), [store]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // hydration 뒤에 디스크 저장값을 읽어 반영한다(서버 렌더와 충돌하지 않도록 여기서 처리).
  useEffect(() => {
    store.hydrate();
  }, [store]);
  return value;
}
