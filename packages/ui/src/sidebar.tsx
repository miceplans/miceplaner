'use client';

import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './dialog';

export type SidebarKey =
  | 'events'
  | 'years'
  | 'calendar'
  | 'tasks'
  | 'leave'
  | 'clients'
  | 'partners'
  | 'notifications';

const A = '/assets/sidebar';

/** 이전 표시/숨김 설정의 localStorage 키. 새 설정으로 한 번만 마이그레이션한다. */
const HIDDEN_NAV_KEY = 'miceplans.sidebar.hiddenNav';

/** 사용자가 구성한 표시 탭 순서의 localStorage 키. */
const NAV_ORDER_KEY = 'miceplans.sidebar.navOrder';

/** 비어 있는 전역 내비게이션을 막기 위한 최소 표시 메뉴 수. */
const MIN_VISIBLE = 1;

const NAV: { key: SidebarKey; label: string; icon: string; size: number; href: string; badge?: number }[] = [
  { key: 'events', label: '행사', icon: 'events', size: 16, href: '/' },
  { key: 'years', label: '년도 별 보기', icon: 'schedules', size: 16, href: '/events-by-year-2' },
  { key: 'tasks', label: '할 일', icon: 'tasks', size: 16, href: '/task-board' },
  { key: 'leave', label: '연차', icon: 'leave', size: 16, href: '/leave' },
  { key: 'clients', label: '고객사', icon: 'clients', size: 17, href: '/client-list' },
  { key: 'partners', label: '협력사', icon: 'partners', size: 17, href: '/partners' },
  { key: 'notifications', label: '알림', icon: 'notifications', size: 16, href: '/notifications' },
];

// 오늘 기준 D-day 계산에 사용한다.
const TODAY = new Date(new Date().setHours(0, 0, 0, 0));

function dDayOf(start: Date): string {
  const diff = Math.round((start.getTime() - TODAY.getTime()) / 86400000);
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : '종료';
}

const RECENT: { name: string; dot: string; start?: Date }[] = [];

function isSidebarKey(value: unknown): value is SidebarKey {
  return typeof value === 'string' && NAV.some((n) => n.key === value);
}

function readNavOrder(): SidebarKey[] {
  try {
    const savedOrder = window.localStorage.getItem(NAV_ORDER_KEY);
    if (savedOrder) {
      const parsed: unknown = JSON.parse(savedOrder);
      if (!Array.isArray(parsed)) return NAV.map((n) => n.key);

      // 중복·삭제된 키를 제거하고, 새 기본 메뉴는 구성 화면에서 추가할 수 있게 둔다.
      return parsed.filter(isSidebarKey).filter((key, index, all) => all.indexOf(key) === index);
    }

    // 기존 "표시 설정" 사용자는 현재 표시 중인 순서를 그대로 이어받는다.
    const raw = window.localStorage.getItem(HIDDEN_NAV_KEY);
    if (!raw) return NAV.map((n) => n.key);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NAV.map((n) => n.key);
    const hidden = parsed.filter(isSidebarKey);
    return NAV.filter((n) => !hidden.includes(n.key)).map((n) => n.key);
  } catch {
    return NAV.map((n) => n.key);
  }
}

export function Sidebar({ active, className = '' }: { active: SidebarKey; className?: string }): ReactNode {
  const [navOrder, setNavOrder] = useState<SidebarKey[]>(NAV.map((n) => n.key));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<SidebarKey | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<SidebarKey | null>(null);

  useEffect(() => {
    setNavOrder(readNavOrder());
  }, []);

  const visibleNav = navOrder.map((key) => NAV.find((n) => n.key === key)).filter((n): n is (typeof NAV)[number] => Boolean(n));
  const availableNav = NAV.filter((n) => !navOrder.includes(n.key));

  const saveNavOrder = (next: SidebarKey[]) => {
    setNavOrder(next);
    try {
      window.localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next));
    } catch {
      // localStorage를 쓸 수 없는 환경에서는 세션 동안만 반영한다.
    }
  };

  const moveNav = (key: SidebarKey, direction: -1 | 1) => {
    const from = navOrder.indexOf(key);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= navOrder.length) return;
    const next = [...navOrder];
    [next[from], next[to]] = [next[to], next[from]];
    saveNavOrder(next);
  };

  const reorderNav = (from: SidebarKey, to: SidebarKey) => {
    const fromIndex = navOrder.indexOf(from);
    const toIndex = navOrder.indexOf(to);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const next = [...navOrder];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, from);
    saveNavOrder(next);
  };

  const startDrag = (event: DragEvent<HTMLDivElement>, key: SidebarKey) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
    setDraggedKey(key);
  };

  const dragOver = (event: DragEvent<HTMLDivElement>, key: SidebarKey) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (key !== draggedKey) setDropTargetKey(key);
  };

  const drop = (event: DragEvent<HTMLDivElement>, target: SidebarKey) => {
    event.preventDefault();
    const source = isSidebarKey(event.dataTransfer.getData('text/plain'))
      ? event.dataTransfer.getData('text/plain') as SidebarKey
      : draggedKey;
    if (source) reorderNav(source, target);
    setDraggedKey(null);
    setDropTargetKey(null);
  };

  const removeNav = (key: SidebarKey) => {
    if (navOrder.length <= MIN_VISIBLE) return;
    saveNavOrder(navOrder.filter((item) => item !== key));
  };

  const addNav = (key: SidebarKey) => {
    if (!navOrder.includes(key)) saveNavOrder([...navOrder, key]);
  };

  const resetNav = () => {
    const defaults = NAV.map((n) => n.key);
    setNavOrder(defaults);
    try {
      window.localStorage.removeItem(NAV_ORDER_KEY);
      window.localStorage.removeItem(HIDDEN_NAV_KEY);
    } catch {
      // localStorage를 쓸 수 없는 환경에서는 세션 동안만 반영한다.
    }
  };

  return (
    <aside className={`flex h-full w-[240px] shrink-0 flex-col overflow-hidden bg-surface-sidebar leading-[normal] max-md:h-auto max-md:w-full max-md:border-b max-md:border-border ${className}`} data-name="Sidebar">
      <div className="flex h-[52px] shrink-0 items-center pl-[12px] pr-[14px] max-md:hidden">
        <div className="flex items-center gap-[7px]">
          <img alt="mice planner" src="/assets/mice-planner-logo.png" className="block h-[11px] w-[116px] object-contain brightness-0" />
          <img alt="" src={`${A}/group5.svg`} className="block h-[26.758px] w-[21px]" />
        </div>
      </div>
      <nav className="flex flex-col gap-[2px] px-[10px] max-md:h-[52px] max-md:flex-row max-md:items-center max-md:gap-0 max-md:overflow-x-auto max-md:px-[8px]">
        {visibleNav.map((n) => (
          <a
            key={n.key}
            href={n.href}
            className={`flex h-[32px] items-center gap-[10px] rounded-sm px-[10px] text-base max-md:shrink-0 ${
              n.key === active ? 'bg-border font-semibold text-fg-strong' : 'text-fg'
            }`}
          >
            <img alt="" src={`${A}/${n.icon}.svg`} style={{ width: n.size, height: n.size }} />
            <span className="whitespace-nowrap">{n.label}</span>
            {n.badge ? (
              <>
                <span className="flex-1" />
                <span className="flex h-[18px] items-center justify-center rounded-md bg-brand px-[7px] text-2xs font-semibold text-fg-inverse">
                  {n.badge}
                </span>
              </>
            ) : null}
          </a>
        ))}
      </nav>
      <div className="hidden shrink-0 border-t border-border px-[8px] py-[6px] max-md:flex">
        <button
          type="button"
          aria-label="사이드탭 구성 수정"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
          className="flex h-[28px] items-center gap-[4px] rounded-sm px-[7px] text-xs font-medium text-fg-secondary hover:bg-surface-chip"
        >
          <img alt="" src={`${A}/settings.svg`} className="size-[14px]" />
          <span>사이드탭 구성 수정</span>
        </button>
      </div>
      <div className="min-h-[5px] flex-1 max-md:hidden" />
      <div className="flex shrink-0 flex-col gap-[4px] px-[10px] max-md:hidden">
        <p className="text-base font-bold text-fg-secondary">최근</p>
        <div className="flex flex-col">
          {RECENT.map((r) => (
            <div key={r.name} className="flex items-center h-[36px] gap-[11px] rounded-lg px-[10px]">
              <img alt="" src={`${A}/${r.dot}.svg`} className="size-[8px]" />
              <span className="whitespace-nowrap text-base font-medium text-fg-secondary">{r.name}</span>
              {r.start && <span className="rounded-sm bg-brand-tint px-[5px] py-px text-2xs font-semibold text-brand">{dDayOf(r.start)}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex h-[52px] shrink-0 items-center gap-[10px] border-t border-solid border-border px-[14px] max-md:hidden">
        <button
          type="button"
          aria-label="사이드탭 구성 수정"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
          className="flex h-[26px] items-center gap-[3px] rounded-sm px-[4px] text-2xs font-medium text-fg-secondary hover:bg-surface-chip"
        >
          <img alt="" src={`${A}/settings.svg`} className="size-[15px]" />
          <span>구성 수정</span>
        </button>
        <img alt="" src={`${A}/chevron.svg`} className="size-[13px]" />
      </div>
      {settingsOpen ? createPortal(
        <Dialog onClose={() => setSettingsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="사이드탭 구성 수정"
            onClick={(e) => e.stopPropagation()}
            className="flex w-[420px] max-w-full flex-col gap-[16px] rounded-lg bg-surface p-[20px] shadow-card"
          >
            <div className="flex items-start gap-[12px]">
              <div className="flex-1">
                <h2 className="m-0 text-lg font-semibold text-fg">사이드탭 구성 수정</h2>
                <p className="m-0 mt-[4px] text-base text-fg-secondary">탭을 드래그해 순서를 바꾸고, 필요 없는 탭은 제거하거나 다시 추가할 수 있습니다.</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="구성 수정 닫기" className="flex size-[28px] items-center justify-center rounded-sm text-lg text-fg-secondary hover:bg-surface-chip">
                ×
              </button>
            </div>
            <section aria-labelledby="visible-tabs-title" className="flex flex-col gap-[6px]">
              <div className="flex items-center">
                <h3 id="visible-tabs-title" className="m-0 flex-1 text-base font-semibold text-fg">표시 중인 탭</h3>
                <span className="text-xs text-fg-tertiary">{visibleNav.length}개</span>
              </div>
              <div role="list" className="flex flex-col gap-[4px]">
                {visibleNav.map((n, index) => (
                  <div
                    key={n.key}
                    role="listitem"
                    draggable
                    aria-grabbed={draggedKey === n.key}
                    onDragStart={(event) => startDrag(event, n.key)}
                    onDragOver={(event) => dragOver(event, n.key)}
                    onDrop={(event) => drop(event, n.key)}
                    onDragEnd={() => { setDraggedKey(null); setDropTargetKey(null); }}
                    className={`flex min-h-[38px] items-center gap-[8px] rounded-md border px-[8px] transition-colors ${
                      draggedKey === n.key ? 'cursor-grabbing border-brand bg-brand-tint opacity-60' : 'cursor-grab border-border'
                    } ${dropTargetKey === n.key ? 'border-brand bg-brand-tint' : ''}`}
                  >
                    <span aria-hidden="true" className="text-base leading-none text-fg-tertiary">⠿</span>
                    <img alt="" src={`${A}/${n.icon}.svg`} style={{ width: n.size, height: n.size }} />
                    <span className="flex-1 whitespace-nowrap text-base text-fg">{n.label}</span>
                    <button type="button" onClick={() => moveNav(n.key, -1)} disabled={index === 0} aria-label={`${n.label} 탭 위로 이동`} className="flex size-[26px] items-center justify-center rounded-sm text-base text-fg-secondary hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveNav(n.key, 1)} disabled={index === visibleNav.length - 1} aria-label={`${n.label} 탭 아래로 이동`} className="flex size-[26px] items-center justify-center rounded-sm text-base text-fg-secondary hover:bg-surface-chip disabled:cursor-not-allowed disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => removeNav(n.key)} disabled={visibleNav.length <= MIN_VISIBLE} aria-label={`${n.label} 탭 제거`} className="flex h-[26px] items-center rounded-sm px-[6px] text-xs text-error-delay hover:bg-error-bg disabled:cursor-not-allowed disabled:opacity-30">제거</button>
                  </div>
                ))}
              </div>
              {visibleNav.length <= MIN_VISIBLE ? <p className="m-0 text-xs text-fg-tertiary">사이드바에는 최소 한 개의 탭이 필요합니다.</p> : null}
            </section>
            <section aria-labelledby="available-tabs-title" className="flex flex-col gap-[6px]">
              <h3 id="available-tabs-title" className="m-0 text-base font-semibold text-fg">추가할 수 있는 탭</h3>
              {availableNav.length ? (
                <div className="flex flex-col gap-[4px]">
                  {availableNav.map((n) => (
                    <div key={n.key} className="flex min-h-[36px] items-center gap-[8px] rounded-md bg-surface-sunken px-[8px]">
                      <img alt="" src={`${A}/${n.icon}.svg`} style={{ width: n.size, height: n.size }} />
                      <span className="flex-1 whitespace-nowrap text-base text-fg">{n.label}</span>
                      <button type="button" onClick={() => addNav(n.key)} className="rounded-sm border border-border bg-surface px-[8px] py-[3px] text-xs font-medium text-fg hover:bg-surface-chip">+ 추가</button>
                    </div>
                  ))}
                </div>
              ) : <p className="m-0 text-xs text-fg-tertiary">추가할 수 있는 탭이 없습니다.</p>}
            </section>
            <div className="flex items-center justify-between border-t border-border pt-[12px]">
              <button type="button" onClick={resetNav} className="rounded-sm px-[6px] py-[5px] text-xs text-fg-secondary hover:bg-surface-chip">기본 구성으로 초기화</button>
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-sm bg-brand px-[12px] py-[6px] text-xs font-semibold text-fg-inverse">완료</button>
            </div>
          </div>
        </Dialog>
      , document.body) : null}
    </aside>
  );
}

export function AppShell({ active, children }: { active: SidebarKey; children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-screen w-full bg-surface max-md:flex-col">
      <div className="sticky top-0 h-screen min-h-[900px] shrink-0 self-start max-md:static max-md:h-auto max-md:min-h-0">
        <Sidebar active={active} />
      </div>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
