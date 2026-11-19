'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Input, StatusPill, type StatusKey } from '@miceplans/ui';
import { useDirectoryClients, useEventsList } from '../../lib/api/generated/endpoints';
import type { ClientDto, EventListItemDto } from '../../lib/api/generated/model';

const A = '/assets/client-list';

type Client = {
  id: string;
  name: string;
  manager: string;
  phone: string;
  event: string;
  /** 최근 행사의 ID. 있으면 행사 상세 페이지로 연결한다. */
  eventId?: string;
  eventMeta: string;
  /** 연결된 행사가 없으면 상태를 표시하지 않는다. */
  status: StatusKey | null;
};

/** 고객사별 대표 행사: 진행중 행사 중 가장 이른 것, 없으면 가장 최근 행사. */
function pickEvent(events: EventListItemDto[]): EventListItemDto | undefined {
  const active = events.filter((e) => e.status === '진행중').sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (active[0]) return active[0];
  return [...events].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

function toRows(clients: ClientDto[], events: EventListItemDto[]): Client[] {
  const byClient = new Map<string, EventListItemDto[]>();
  for (const e of events) byClient.set(e.clientId, [...(byClient.get(e.clientId) ?? []), e]);
  return clients.map((c) => {
    const list = byClient.get(c.id) ?? [];
    const ev = pickEvent(list);
    const range = ev ? (ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} ~ ${ev.endDate}`) : '';
    const extra = list.length > 1 ? ` · 외 ${list.length - 1}건` : '';
    return {
      id: c.id,
      name: c.name,
      manager: ev?.pmName ?? '-',
      phone: '',
      event: ev?.name ?? '진행 행사 없음',
      eventId: ev?.id,
      eventMeta: ev ? [range, ev.place].filter(Boolean).join(' · ') + extra : '',
      status: ev?.status ?? null,
    };
  });
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

const ORDER_KEY = 'miceplans.client-list.order';

function loadOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function applyOrder(list: Client[], ids: string[]): Client[] {
  const byId = new Map(list.map((c) => [c.id, c]));
  const ordered = ids.map((id) => byId.get(id)).filter((c): c is Client => Boolean(c));
  return [...ordered, ...list.filter((c) => !ids.includes(c.id))];
}

function saveOrder(list: Client[]) {
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(list.map((c) => c.id)));
  } catch {
    // localStorage를 쓸 수 없는 환경에서는 저장을 생략한다.
  }
}

export function ClientListView() {
  const clientsQuery = useDirectoryClients();
  const eventsQuery = useEventsList();
  const base = useMemo(
    () => toRows(clientsQuery.data ?? [], eventsQuery.data ?? []),
    [clientsQuery.data, eventsQuery.data],
  );
  const [order, setOrder] = useState<string[]>([]);
  // 저장된 순서는 hydration 이후에 적용해 서버 렌더 결과와 맞춘다.
  useEffect(() => { setOrder(loadOrder()); }, []);
  const clients = useMemo(() => applyOrder(base, order), [base, order]);
  const loading = clientsQuery.isPending;
  const loadFailed = clientsQuery.isError || eventsQuery.isError;
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<{ from: string; over: string } | null>(null);
  const q = query.trim().toLowerCase();
  const rows = q
    ? clients.filter((c) => [c.name, c.manager, c.event].some((v) => v.toLowerCase().includes(q)))
    : clients;

  const allowDrop = (event: DragEvent) => event.preventDefault();

  const dropClient = (toId: string) => {
    if (!drag) return;
    const next = reorder(clients, clients.findIndex((client) => client.id === drag.from), clients.findIndex((client) => client.id === toId));
    saveOrder(next);
    setOrder(next.map((c) => c.id));
    setDrag(null);
  };

  return (
    <div className="flex min-h-[900px] w-full flex-col leading-[normal]">
      <div className="flex h-[56px] shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
        <div className="flex h-full items-center">
          <span className="whitespace-nowrap text-base font-medium text-fg">고객사</span>
        </div>
        <div className="h-px min-w-px flex-1" />
      </div>
      <div className="relative flex min-h-px flex-1 flex-col bg-surface-sunken">
        <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] bg-surface px-[24px] py-[20px]">
          <div className="flex w-full items-center justify-between bg-surface">
            <label className="flex h-[30px] w-[210px] items-center gap-[8px] rounded-sm bg-surface-chip px-[10px]">
              <img alt="" src={`${A}/search-icon.svg`} className="size-[13px] shrink-0" />
              <Input
                variant="ghost"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="고객사 · 담당자 검색"
                className="flex-1 bg-transparent text-xs"
              />
            </label>
            <button type="button" className="flex h-[30px] items-center gap-[6px] rounded-sm bg-brand px-[12px]">
              <img alt="" src={`${A}/plus-icon.svg`} className="size-[13px]" />
              <span className="whitespace-nowrap text-sm font-medium text-fg-inverse">고객사 추가</span>
            </button>
          </div>
          <div className="flex w-full flex-col items-start rounded-lg border border-solid border-border">
            <div className="flex h-[36px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface-sunken px-[16px] text-2xs font-semibold tracking-[0.4px] text-fg-tertiary">
              <div className="w-[20px] shrink-0" />
              <span className="w-[180px] shrink-0">고객사</span>
              <span className="w-[100px] shrink-0">담당자</span>
              <span className="w-[480px] shrink-0">진행 행사</span>
              <span className="whitespace-nowrap">상태</span>
            </div>
            {(loading || loadFailed || rows.length === 0) && (
              <div className="flex h-[48px] w-full items-center px-[16px] text-sm text-fg-tertiary">
                {loading ? '불러오는 중…' : loadFailed ? '고객사 목록을 불러오지 못했습니다.' : q ? '검색 결과가 없습니다.' : '등록된 고객사가 없습니다.'}
              </div>
            )}
            {rows.map((c, i) => {
              const dragging = drag?.from === c.id;
              const over = drag && drag.over === c.id && drag.from !== c.id;
              const rank = clients.findIndex((client) => client.id === c.id) + 1;
              return (
              <div
                key={c.id}
                onDragOver={(event) => { allowDrop(event); if (drag && drag.over !== c.id) setDrag({ ...drag, over: c.id }); }}
                onDrop={() => dropClient(c.id)}
                className={`flex h-[48px] w-full shrink-0 items-center gap-[12px] px-[16px] ${i < rows.length - 1 ? 'border-b border-solid border-border' : ''} ${dragging ? 'opacity-40' : ''} ${over ? (clients.findIndex((client) => client.id === drag!.from) < clients.findIndex((client) => client.id === c.id) ? 'shadow-[inset_0_-2px_0_0_currentColor]' : 'shadow-[inset_0_2px_0_0_currentColor]') : ''}`}
              >
                <button
                  type="button"
                  draggable
                  aria-label={`${c.name} 순서 변경`}
                  onDragStart={(event) => {
                    const row = event.currentTarget.parentElement;
                    if (row) event.dataTransfer.setDragImage(row, 12, 24);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', c.id);
                    setDrag({ from: c.id, over: c.id });
                  }}
                  onDragEnd={() => setDrag(null)}
                  className="flex size-[20px] shrink-0 cursor-grab items-center justify-center rounded text-fg-tertiary hover:bg-surface-sunken hover:text-fg active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span aria-hidden="true" className="text-base leading-none">⠿</span>
                </button>
                <div className="flex h-full w-[180px] shrink-0 items-center gap-[8px]">
                  <span className="w-[16px] shrink-0 whitespace-nowrap text-2xs font-semibold text-fg-tertiary">{rank}</span>
                  <span className="whitespace-nowrap text-base font-semibold text-fg">{c.name}</span>
                </div>
                <div className="flex w-[100px] shrink-0 flex-col items-start gap-[2px] whitespace-nowrap">
                  <span className="text-xs font-medium text-fg-secondary">{c.manager}</span>
                  <span className="text-2xs text-fg-tertiary">{c.phone}</span>
                </div>
                {c.eventId ? (
                  <a
                    href={`/events/detail?id=${encodeURIComponent(c.eventId)}`}
                    aria-label={`${c.event} 상세 보기`}
                    className="flex h-full w-[480px] shrink-0 flex-col items-start justify-center gap-[2px] whitespace-nowrap no-underline outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="text-sm font-medium text-fg">{c.event}</span>
                    <span className="text-2xs text-fg-tertiary">{c.eventMeta}</span>
                  </a>
                ) : (
                  <div className="flex h-full w-[480px] shrink-0 flex-col items-start justify-center gap-[2px] whitespace-nowrap">
                    <span className="text-sm font-medium text-fg">{c.event}</span>
                    <span className="text-2xs text-fg-tertiary">{c.eventMeta}</span>
                  </div>
                )}
                <div className="flex h-full w-[100px] shrink-0 items-center">
                  <div className="relative h-[24px] w-[96px] shrink-0">
                    {c.status && <StatusPill status={c.status} />}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
