'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@miceplans/ui';
import { ApiError, getToken } from '../../../lib/api';
import {
  eventItemsCreate,
  eventListsRemoveBlock,
  eventListsRemoveProduct,
  eventListsSaveBlock,
  eventListsSaveProduct,
  getEventItemsListQueryKey,
  getEventListsListBlocksQueryKey,
  getEventListsListProductsQueryKey,
  itemsAssign,
  itemsRemove,
  itemsReschedule,
  itemsUpdate,
  useDirectoryUsers,
  useEventItemsList,
  useEventListsListBlocks,
  useEventListsListProducts,
} from '../../../lib/api/generated/endpoints';
import type { EventItemDto } from '../../../lib/api/generated/model';
import { normalizeTree, resolveOwners, type CheckItem } from './event-checklist-model';
import type { RequestRow } from './event-products-model';
import type { CalEvent } from './event-calendar';
import {
  baseMonday, blockBody, blockFromDto, diffRows, diffTrees, productBody, productFromDto, sameBlock, sameProduct, treeFromItems, type ItemOp,
} from './event-lists-sync';
import { migrateLocalEventLists } from './migrate-local-lists';

/** 입력·드래그 중에는 마지막 값만 저장하도록 행 단위로 잠시 기다린다. */
const ROW_SAVE_DELAY = 500;

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? (error.status === 409 ? '다른 사람이 먼저 바꿨습니다. 최신 내용으로 다시 불러옵니다.' : error.message) : fallback;

/**
 * 행사 상세의 스케줄·할 일, 제작물, 캘린더 블록 (명세 F-04). 기준 저장소는 서버이며 화면은 바로 반영하고 API를 차례로 부른다.
 * 대기 중인 저장이 모두 끝나면 서버 목록을 다시 받아 화면을 맞춘다. 실패하면 알리고 서버 상태로 되돌린다.
 * 이 기기에 남아 있던 예전 저장값은 처음 열 때 서버로 옮긴다.
 */
export function useEventLists(eventId: string, assignable: string[]) {
  const queryClient = useQueryClient();
  const enabled = eventId !== '' && getToken() !== null;
  const users = useDirectoryUsers({ query: { enabled: getToken() !== null, staleTime: 60_000 } });
  const itemsQuery = useEventItemsList(eventId, undefined, { query: { enabled } });
  const productsQuery = useEventListsListProducts(eventId, { query: { enabled } });
  const blocksQuery = useEventListsListBlocks(eventId, { query: { enabled } });

  const nameById = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u.name])), [users.data]);
  const idByName = useMemo(() => new Map((users.data ?? []).map((u) => [u.name, u.id])), [users.data]);
  const assignableRef = useRef(assignable);
  assignableRef.current = assignable;
  const base = useMemo(() => baseMonday(), []);

  const [schedule, setScheduleState] = useState<CheckItem[]>([]);
  const [products, setProductsState] = useState<RequestRow[]>([]);
  const [calEvents, setCalEventsState] = useState<CalEvent[]>([]);
  const scheduleRef = useRef(schedule);
  const productsRef = useRef(products);
  const calEventsRef = useRef(calEvents);

  // 저장 대기열. 한 번에 하나씩 보내 상위 항목이 먼저 만들어지고 version이 순서대로 오른다.
  const pending = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const versions = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, { timer: number; run: () => void }>());

  // 저장이 실패하면 대기열이 빈 뒤 서버 상태로 되돌린다. 서버 목록이 그대로면 쿼리 데이터가 바뀌지 않으므로 직접 다시 그린다.
  const failed = useRef(false);
  const latest = useRef({ items: itemsQuery.data, products: productsQuery.data, blocks: blocksQuery.data, nameById: new Map<string, string>() });
  const resetFromServer = useCallback(() => {
    const { items, products: productDtos, blocks, nameById: names } = latest.current;
    if (items) {
      const next = normalizeTree(resolveOwners(treeFromItems(items, (id) => names.get(id)), assignableRef.current));
      scheduleRef.current = next;
      setScheduleState(next);
    }
    if (productDtos) {
      const next = productDtos.map(productFromDto);
      productsRef.current = next;
      setProductsState(next);
    }
    if (blocks) {
      const next = blocks.map((b) => blockFromDto(b, base));
      calEventsRef.current = next;
      setCalEventsState(next);
    }
  }, [base]);

  const refetchAll = useCallback(() => {
    if (!eventId) return;
    void queryClient.invalidateQueries({ queryKey: getEventItemsListQueryKey(eventId) });
    void queryClient.invalidateQueries({ queryKey: getEventListsListProductsQueryKey(eventId) });
    void queryClient.invalidateQueries({ queryKey: getEventListsListBlocksQueryKey(eventId) });
  }, [eventId, queryClient]);

  const enqueue = useCallback((label: string, task: () => Promise<unknown>) => {
    pending.current += 1;
    chain.current = chain.current
      .then(async () => { await task(); })
      .catch((error: unknown) => {
        // 이미 지워진 항목을 다시 지우는 것은 실패가 아니다.
        if (label.endsWith('삭제') && error instanceof ApiError && error.status === 404) return;
        failed.current = true;
        toast.error(errorText(error, `[500] ${label}에 실패했습니다.`));
      })
      .finally(() => {
        pending.current -= 1;
        if (pending.current > 0) return;
        if (failed.current) {
          failed.current = false;
          resetFromServer();
        }
        refetchAll();
      });
  }, [refetchAll, resetFromServer]);

  const remember = (dto: EventItemDto) => versions.current.set(dto.id, dto.version);

  const runItemOp = useCallback((op: ItemOp) => {
    const assigneeId = (name: string | undefined) => {
      if (!name) return null;
      const id = idByName.get(name);
      if (!id) throw new Error(`담당자 '${name}'을(를) 찾을 수 없습니다.`);
      return id;
    };
    const version = (id: string) => versions.current.get(id) ?? 1;
    switch (op.type) {
      case 'create':
        enqueue('할 일 추가', async () => remember(await eventItemsCreate(eventId, {
          id: op.id, kind: op.kind, parentId: op.parentId, title: op.title.trim() || '제목 없음', status: op.status, dueOn: op.dueOn,
          startMinute: op.startMinute, endMinute: op.endMinute, part: op.part ?? null, assigneeId: assigneeId(op.assignee), description: '', startsOn: null,
        })));
        return;
      case 'update':
        enqueue('할 일 수정', async () => remember(await itemsUpdate(op.id, op.patch)));
        return;
      case 'assign':
        enqueue('담당자 변경', async () => remember(await itemsAssign(op.id, { assigneeId: assigneeId(op.assignee), expectedVersion: version(op.id) })));
        return;
      case 'reschedule':
        enqueue('날짜 변경', async () => remember(await itemsReschedule(op.id, { startsOn: null, dueOn: op.dueOn, expectedVersion: version(op.id) })));
        return;
      case 'remove':
        enqueue('삭제', () => itemsRemove(op.id));
        return;
    }
  }, [enqueue, eventId, idByName]);

  /** 입력 중인 행은 마지막 값만 보낸다. 같은 키의 이전 예약을 지우고 다시 건다. */
  const debounce = useCallback((key: string, run: () => void) => {
    const prev = timers.current.get(key);
    if (prev) window.clearTimeout(prev.timer);
    pending.current += 1;
    const fire = () => {
      timers.current.delete(key);
      pending.current -= 1;
      run();
    };
    timers.current.set(key, { timer: window.setTimeout(fire, ROW_SAVE_DELAY), run: fire });
    if (prev) pending.current -= 1;
  }, []);

  // 페이지를 떠날 때 예약된 저장을 바로 보낸다.
  useEffect(() => {
    const flush = () => {
      for (const { timer, run } of [...timers.current.values()]) {
        window.clearTimeout(timer);
        run();
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [eventId]);

  // 서버 목록이 바뀌고 대기 중인 저장이 없으면 화면을 서버 상태로 맞춘다.
  latest.current = { items: itemsQuery.data, products: productsQuery.data, blocks: blocksQuery.data, nameById };
  useEffect(() => {
    if (!itemsQuery.data) return;
    for (const it of itemsQuery.data) versions.current.set(it.id, it.version);
    if (pending.current > 0) return;
    const next = normalizeTree(resolveOwners(treeFromItems(itemsQuery.data, (id) => nameById.get(id)), assignableRef.current));
    scheduleRef.current = next;
    setScheduleState(next);
  }, [itemsQuery.data, nameById]);
  useEffect(() => {
    if (!productsQuery.data || pending.current > 0) return;
    const next = productsQuery.data.map(productFromDto);
    productsRef.current = next;
    setProductsState(next);
  }, [productsQuery.data]);
  useEffect(() => {
    if (!blocksQuery.data || pending.current > 0) return;
    const next = blocksQuery.data.map((b) => blockFromDto(b, base));
    calEventsRef.current = next;
    setCalEventsState(next);
  }, [blocksQuery.data, base]);

  // 행사가 바뀌면 이전 행사의 화면 상태를 비운다.
  useEffect(() => {
    scheduleRef.current = [];
    productsRef.current = [];
    calEventsRef.current = [];
    setScheduleState([]);
    setProductsState([]);
    setCalEventsState([]);
  }, [eventId]);

  // 멤버 정보가 늦게 확인되면 지금 트리의 소유자만 다시 맞춘다.
  useEffect(() => {
    const next = resolveOwners(scheduleRef.current, assignable);
    scheduleRef.current = next;
    setScheduleState(next);
  }, [assignable]);

  // 이 기기에 남은 예전 저장값을 서버로 옮긴다. 서버 목록과 직원 명단을 받은 뒤 행사마다 한 번만 시도한다.
  const migratedFor = useRef<string | null>(null);
  const ready = enabled && itemsQuery.isSuccess && productsQuery.isSuccess && blocksQuery.isSuccess && users.isSuccess;
  useEffect(() => {
    if (!ready || migratedFor.current === eventId) return;
    migratedFor.current = eventId;
    void migrateLocalEventLists(eventId, idByName).then((result) => {
      if (result === 'moved') refetchAll();
      if (result === 'failed') toast.error('이 기기에 저장된 스케줄·할 일을 서버로 옮기지 못했습니다. 행사 멤버만 옮길 수 있습니다.');
    });
  }, [ready, eventId, idByName, refetchAll]);

  const setSchedule = useCallback((action: SetStateAction<CheckItem[]>) => {
    const prev = scheduleRef.current;
    const next = typeof action === 'function' ? action(prev) : action;
    if (next === prev) return;
    scheduleRef.current = next;
    setScheduleState(next);
    for (const op of diffTrees(prev, next)) runItemOp(op);
  }, [runItemOp]);

  const setProducts = useCallback((action: SetStateAction<RequestRow[]>) => {
    const prev = productsRef.current;
    const next = typeof action === 'function' ? action(prev) : action;
    if (next === prev) return;
    productsRef.current = next;
    setProductsState(next);
    const { save, remove } = diffRows(prev, next, sameProduct);
    for (const row of save) {
      debounce(`product:${row.id}`, () => {
        const latest = productsRef.current.find((r) => r.id === row.id);
        if (latest) enqueue('제작물 저장', () => eventListsSaveProduct(eventId, latest.id, productBody(latest)));
      });
    }
    for (const id of remove) {
      const t = timers.current.get(`product:${id}`);
      if (t) { window.clearTimeout(t.timer); timers.current.delete(`product:${id}`); pending.current -= 1; }
      enqueue('제작물 삭제', () => eventListsRemoveProduct(eventId, id));
    }
  }, [enqueue, eventId, debounce]);

  const setCalEvents = useCallback((action: SetStateAction<CalEvent[]>) => {
    const prev = calEventsRef.current;
    const next = typeof action === 'function' ? action(prev) : action;
    if (next === prev) return;
    calEventsRef.current = next;
    setCalEventsState(next);
    const own = (list: CalEvent[]) => list.filter((e) => e.eventId === eventId && e.source !== 'schedule');
    const { save, remove } = diffRows(own(prev), own(next), sameBlock);
    for (const block of save) {
      debounce(`block:${block.id}`, () => {
        const latest = calEventsRef.current.find((b) => b.id === block.id);
        if (latest) enqueue('캘린더 일정 저장', () => eventListsSaveBlock(eventId, latest.id, blockBody(latest, base)));
      });
    }
    for (const id of remove) {
      const t = timers.current.get(`block:${id}`);
      if (t) { window.clearTimeout(t.timer); timers.current.delete(`block:${id}`); pending.current -= 1; }
      enqueue('캘린더 일정 삭제', () => eventListsRemoveBlock(eventId, id));
    }
  }, [base, enqueue, eventId, debounce]);

  const loading = itemsQuery.isPending && itemsQuery.fetchStatus !== 'idle';
  return { schedule, setSchedule, products, setProducts, calEvents, setCalEvents, loading };
}
