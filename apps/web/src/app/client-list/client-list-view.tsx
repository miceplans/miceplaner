'use client';

import { useState, type DragEvent } from 'react';
import { StatusPill, type StatusKey } from '@miceplans/ui';

const A = '/assets/client-list';

type Client = {
  id: string;
  name: string;
  manager: string;
  phone: string;
  event: string;
  eventMeta: string;
  status: StatusKey;
};

const CLIENTS: Client[] = [
  { id: 'c1', name: '메디코리아', manager: '김민석 차장', phone: '02-1234-5678', event: '제54회 KIMES 2025', eventMeta: '03.13 – 03.16 · 코엑스 Hall A·B', status: '진행중' },
  { id: 'c2', name: '글로벌AI서밋 조직위', manager: '이준호 팀장', phone: '02-3456-7890', event: '글로벌 AI 서밋 2025', eventMeta: '05.21 – 05.23 · 코엑스 Hall C', status: '진행중' },
  { id: 'c3', name: '삼성전자', manager: '박지연 과장', phone: '02-5678-1234', event: 'K-데모데이 2025', eventMeta: '06.05 · 역삼 사옥 1F', status: '진행중' },
  { id: 'c4', name: '한국프랜차이즈협회', manager: '최은주 부장', phone: '02-7890-3456', event: '프랜차이즈 엑스포 2025', eventMeta: '04.02 – 04.04 · 킨텍스', status: '성공' },
  { id: 'c5', name: '로진컴퍼니', manager: '서동현 대리', phone: '02-2468-1357', event: '브랜드 갤라 나이트', eventMeta: '11.28 · 포시즌스 서울', status: '진행중' },
];

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

const ORDER_KEY = 'miceplans.client-list.order';

function loadOrder(): Client[] {
  if (typeof window === 'undefined') return CLIENTS;
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    if (!raw) return CLIENTS;
    const ids = JSON.parse(raw) as string[];
    const byId = new Map(CLIENTS.map((c) => [c.id, c]));
    const ordered = ids.map((id) => byId.get(id)).filter((c): c is Client => Boolean(c));
    return [...ordered, ...CLIENTS.filter((c) => !ids.includes(c.id))];
  } catch {
    return CLIENTS;
  }
}

function saveOrder(list: Client[]) {
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(list.map((c) => c.id)));
  } catch {
    // localStorage를 쓸 수 없는 환경에서는 저장을 생략한다.
  }
}

export function ClientListView() {
  const [clients, setClients] = useState<Client[]>(loadOrder);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<{ from: string; over: string } | null>(null);
  const q = query.trim().toLowerCase();
  const rows = q
    ? clients.filter((c) => [c.name, c.manager, c.event].some((v) => v.toLowerCase().includes(q)))
    : clients;

  const allowDrop = (event: DragEvent) => event.preventDefault();

  const dropClient = (toId: string) => {
    if (!drag) return;
    setClients((list) => {
      const next = reorder(list, list.findIndex((client) => client.id === drag.from), list.findIndex((client) => client.id === toId));
      saveOrder(next);
      return next;
    });
    setDrag(null);
  };

  return (
    <div className="flex min-h-[900px] w-full flex-col leading-[normal]">
      <div className="flex h-[56px] shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
        <div className="flex h-full items-center">
          <span className="whitespace-nowrap text-base font-medium text-fg">Clients</span>
        </div>
        <div className="h-px min-w-px flex-1" />
      </div>
      <div className="relative flex min-h-px flex-1 flex-col bg-surface-sunken">
        <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] bg-surface px-[24px] py-[20px]">
          <div className="flex w-full items-center justify-between bg-surface">
            <label className="flex h-[30px] w-[210px] items-center gap-[8px] rounded-sm bg-surface-chip px-[10px]">
              <img alt="" src={`${A}/search-icon.svg`} className="size-[13px] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="고객사 · 담당자 검색"
                className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-tertiary"
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
                <div className="flex h-full w-[480px] shrink-0 flex-col items-start justify-center gap-[2px] whitespace-nowrap">
                  <span className="text-sm font-medium text-fg">{c.event}</span>
                  <span className="text-2xs text-fg-tertiary">{c.eventMeta}</span>
                </div>
                <div className="flex h-full w-[100px] shrink-0 items-center">
                  <div className="relative h-[24px] w-[96px] shrink-0">
                    <StatusPill status={c.status} />
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
