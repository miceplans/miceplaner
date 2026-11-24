'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeTree, resolveOwners, type CheckItem } from './event-checklist-model';
import type { RequestRow } from './event-products-model';
import type { CalEvent } from './event-calendar';

/** 스케줄의 children은 할 일, 할 일의 children은 하위 할 일이다. 할 일 탭에서 계층으로 다룬다. */
const INITIAL_SCHEDULE: CheckItem[] = [];

/**
 * 행사 상세의 스케줄·제작물·캘린더 블록 상태. 서버 연결 전까지 브라우저 저장소에 둔다.
 * 저장값은 행사 키가 바뀔 때만 읽는다. eventId가 빈 값(첫 렌더)이면 저장 자체를 건드리지 않고,
 * 담당자 정보가 늦게 도착해도 읽기를 반복하지 않아 편집 중인 상태를 덮지 않는다.
 */
export function useEventLists(eventId: string, assignable: string[]) {
  const [schedule, setSchedule] = useState(() => resolveOwners(INITIAL_SCHEDULE, assignable));
  const [products, setProducts] = useState<RequestRow[]>([]);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const listsKey = eventId ? `miceplans.event-lists.${eventId}` : null;
  const [listsLoadedKey, setListsLoadedKey] = useState<string | null>(null);
  const assignableRef = useRef(assignable);
  assignableRef.current = assignable;

  // 서버 연결 전까지 체크 상태는 브라우저에 저장한다.
  useEffect(() => {
    if (!listsKey) return;
    try {
      const raw = window.localStorage.getItem(listsKey);
      if (raw) {
        const saved = JSON.parse(raw) as { schedule?: CheckItem[]; calEvents?: CalEvent[] };
        if (saved.schedule) setSchedule(normalizeTree(resolveOwners(saved.schedule, assignableRef.current)));
        if (Array.isArray((saved as { products?: RequestRow[] }).products)) setProducts((saved as { products: RequestRow[] }).products);
        if (Array.isArray(saved.calEvents)) setCalEvents(saved.calEvents);
      } else {
        // 저장값이 없으면 이전 행사 데이터가 새 키로 흘러가지 않게 비운다.
        setSchedule(resolveOwners(INITIAL_SCHEDULE, assignableRef.current));
        setProducts([]);
        setCalEvents([]);
      }
    } catch {
      // 저장소를 쓸 수 없으면 기본 데이터로 시작한다.
    }
    setListsLoadedKey(listsKey);
  }, [listsKey]);

  // 멤버 정보가 늦게 확인되면 저장값을 다시 읽지 않고 지금 트리의 소유자만 다시 맞춘다.
  useEffect(() => {
    setSchedule((current) => resolveOwners(current, assignable));
  }, [assignable]);

  // 타이핑·드래그마다 디스크에 쓰지 않도록 마지막 변경만 잠시 뒤에 저장하고, 페이지를 떠날 때 즉시 비운다.
  const pendingLists = useRef<{ key: string; timer: number; schedule: CheckItem[]; products: RequestRow[]; calEvents: CalEvent[] } | null>(null);
  const flushLists = useCallback(() => {
    const pending = pendingLists.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingLists.current = null;
    try {
      window.localStorage.setItem(pending.key, JSON.stringify({ schedule: pending.schedule, products: pending.products, calEvents: pending.calEvents }));
    } catch {
      // 저장 실패는 화면 상태에만 영향을 주므로 무시한다.
    }
  }, []);
  useEffect(() => {
    if (!listsKey || listsLoadedKey !== listsKey) return;
    if (pendingLists.current) window.clearTimeout(pendingLists.current.timer);
    pendingLists.current = { key: listsKey, schedule, products, calEvents, timer: window.setTimeout(flushLists, 400) };
  }, [schedule, products, calEvents, listsKey, listsLoadedKey, flushLists]);
  useEffect(() => {
    window.addEventListener('pagehide', flushLists);
    return () => {
      window.removeEventListener('pagehide', flushLists);
      flushLists();
    };
  }, [flushLists]);

  return { schedule, setSchedule, products, setProducts, calEvents, setCalEvents };
}
