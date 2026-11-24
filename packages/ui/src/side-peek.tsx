'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import {
  SidePeekTextField,
  type AgendaItem,
  type SidePeekContent,
  type SidePeekStore,
} from './side-peek-base';
import { AgendaSection, AssigneeRow, LinksSection, TaskSubtaskSection } from './side-peek-sections';

const A = '/assets/schedule';

type PeekComponentKey = 'period' | 'place' | 'assignee' | 'agenda' | 'description' | 'clientMemo' | 'tasks' | 'links';
const PEEK_COMPONENTS: { key: PeekComponentKey; label: string }[] = [
  { key: 'period', label: '기간' },
  { key: 'place', label: '장소' },
  { key: 'assignee', label: '담당자' },
  { key: 'agenda', label: '이날의 내 일정' },
  { key: 'description', label: '설명' },
  { key: 'clientMemo', label: '클라이언트 메모' },
  { key: 'tasks', label: '할 일 · 하위 할 일' },
  { key: 'links', label: '관련 링크 및 첨부' },
];
const PEEK_LAYOUT_KEY = 'miceplans.schedule.sidePeekLayout';
const DEFAULT_PEEK_LAYOUT = PEEK_COMPONENTS.map((component) => component.key);

function isPeekComponentKey(value: unknown): value is PeekComponentKey {
  return typeof value === 'string' && PEEK_COMPONENTS.some((component) => component.key === value);
}

function readPeekLayout(): PeekComponentKey[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PEEK_LAYOUT_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return DEFAULT_PEEK_LAYOUT;
    return parsed.filter(isPeekComponentKey).filter((key, index, all) => all.indexOf(key) === index);
  } catch {
    return DEFAULT_PEEK_LAYOUT;
  }
}

type PeekContent = SidePeekContent;

const EMPTY_CONTENT: PeekContent = { assignees: [], description: '', clientMemo: '', tasks: [], links: [] };

/** 텍스트 입력은 잠시 멈췄을 때 저장한다. */
const TEXT_SAVE_DELAY = 600;

export function SidePeekPanel({
  title,
  date,
  period,
  place,
  agenda,
  members = [],
  storageKey,
  store,
  onClose,
}: {
  title: string;
  date?: string;
  period?: string;
  place?: string;
  agenda?: AgendaItem[];
  /** 담당자로 지정할 수 있는 인력 이름 */
  members?: string[];
  /** 패널 내용을 저장할 키. 없으면 제목과 날짜로 만든다. */
  storageKey?: string;
  /** 패널 내용 저장소. 없으면 화면에서만 편집되고 저장되지 않는다. */
  store?: SidePeekStore;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const contentKey = storageKey ?? `${date ?? ''}|${title}`;
  const [content, setContent] = useState<PeekContent>(EMPTY_CONTENT);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(store ? 'loading' : 'ready');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const versionRef = useRef(0);
  // 아직 서버에 보내지 않은 변경. 키가 바뀌거나 패널이 닫혀도 원래 키로 보낸다.
  const pendingRef = useRef<{ key: string; patch: Partial<PeekContent> } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 저장은 한 번에 하나씩 보내 version이 순서대로 오르게 한다.
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const storeRef = useRef(store);
  storeRef.current = store;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    const target = storeRef.current;
    if (!pending || !target) return;
    pendingRef.current = null;
    setSaveState('saving');
    chainRef.current = chainRef.current.then(async () => {
      try {
        const result = await target.save(pending.key, pending.patch, versionRef.current);
        if (!result.conflict) {
          versionRef.current = result.version;
          setSaveState(pendingRef.current ? 'saving' : 'saved');
          return;
        }
        // 다른 사용자가 먼저 담당자를 바꿨다. 최신 내용을 다시 읽고, 담당자 외 변경은 다시 보낸다.
        const latest = await target.load(pending.key);
        versionRef.current = latest.version;
        const rest = { ...pending.patch };
        delete rest.assignees;
        setContent((prev) => ({ ...prev, assignees: latest.content.assignees }));
        setNotice('다른 사용자가 담당자를 먼저 바꿔 최신 담당자로 갱신했습니다. 필요하면 다시 지정해 주세요.');
        if (Object.keys(rest).length) {
          pendingRef.current = { key: pending.key, patch: { ...rest, ...(pendingRef.current?.key === pending.key ? pendingRef.current.patch : {}) } };
        }
        setSaveState('idle');
        if (pendingRef.current) queueMicrotask(flush);
      } catch {
        // 실패한 변경은 다음 저장에 다시 싣는다.
        const later = pendingRef.current?.key === pending.key ? pendingRef.current.patch : {};
        pendingRef.current = { key: pending.key, patch: { ...pending.patch, ...later } };
        setSaveState('error');
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [flush]);

  useEffect(() => {
    if (!store) {
      setContent(EMPTY_CONTENT);
      setLoadState('ready');
      return;
    }
    let alive = true;
    setLoadState('loading');
    setNotice('');
    setSaveState('idle');
    store
      .load(contentKey)
      .then((data) => {
        if (!alive) return;
        versionRef.current = data.version;
        setContent(data.content);
        setLoadState('ready');
      })
      .catch(() => {
        if (alive) setLoadState('error');
      });
    return () => {
      alive = false;
      flush();
    };
  }, [contentKey, store, reloadTick, flush]);

  const patchContent = (patch: Partial<PeekContent>, { debounce = false }: { debounce?: boolean } = {}) => {
    setContent((prev) => ({ ...prev, ...patch }));
    if (!store) return;
    if (patch.assignees) setNotice('');
    const merged = pendingRef.current?.key === contentKey ? pendingRef.current.patch : {};
    if (pendingRef.current && pendingRef.current.key !== contentKey) flush();
    pendingRef.current = { key: contentKey, patch: { ...merged, ...patch } };
    if (timerRef.current) clearTimeout(timerRef.current);
    if (debounce) timerRef.current = setTimeout(flush, TEXT_SAVE_DELAY);
    else flush();
  };
  const [componentOrder, setComponentOrder] = useState<PeekComponentKey[]>(DEFAULT_PEEK_LAYOUT);
  const [editingLayout, setEditingLayout] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<PeekComponentKey | null>(null);
  const [dropTarget, setDropTarget] = useState<PeekComponentKey | null>(null);

  useEffect(() => {
    setComponentOrder(readPeekLayout());
  }, []);

  const saveComponentOrder = (next: PeekComponentKey[]) => {
    setComponentOrder(next);
    try {
      window.localStorage.setItem(PEEK_LAYOUT_KEY, JSON.stringify(next));
    } catch {
      // 저장할 수 없는 브라우저에서는 현재 화면에만 적용한다.
    }
  };

  const reorderComponent = (from: PeekComponentKey, to: PeekComponentKey) => {
    const fromIndex = componentOrder.indexOf(from);
    const toIndex = componentOrder.indexOf(to);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const next = [...componentOrder];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, from);
    saveComponentOrder(next);
  };

  const startComponentDrag = (event: DragEvent<HTMLDivElement>, key: PeekComponentKey) => {
    if (!editingLayout) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
    setDraggedComponent(key);
  };

  const overComponent = (event: DragEvent<HTMLDivElement>, key: PeekComponentKey) => {
    if (!editingLayout) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (key !== draggedComponent) setDropTarget(key);
  };

  const dropComponent = (event: DragEvent<HTMLDivElement>, target: PeekComponentKey) => {
    if (!editingLayout) return;
    event.preventDefault();
    const payload: unknown = event.dataTransfer.getData('text/plain');
    const source = isPeekComponentKey(payload) ? payload : draggedComponent;
    if (source) reorderComponent(source, target);
    setDraggedComponent(null);
    setDropTarget(null);
  };

  const startPointerDrag = (event: PointerEvent<HTMLSpanElement>, key: PeekComponentKey) => {
    if (!editingLayout) return;
    event.preventDefault();
    setDraggedComponent(key);
  };

  const enterPointerDropTarget = (key: PeekComponentKey) => {
    if (!editingLayout || !draggedComponent || draggedComponent === key) return;
    setDropTarget(key);
    reorderComponent(draggedComponent, key);
  };

  const finishPointerDrag = () => {
    setDraggedComponent(null);
    setDropTarget(null);
  };

  const restoreDefaults = () => {
    setComponentOrder(DEFAULT_PEEK_LAYOUT);
    try {
      window.localStorage.removeItem(PEEK_LAYOUT_KEY);
    } catch {
      // 저장할 수 없는 브라우저에서도 기본 구성을 적용한다.
    }
  };

  const renderComponent = (key: PeekComponentKey): ReactNode => {
    switch (key) {
      case 'period':
      case 'place': {
        const value = key === 'period' ? period : place;
        if (!value) return null;
        return (
          <div className="flex h-[30px] w-full items-center gap-[8.465px] py-[4.699px] text-xs text-fg-strong">
            <div className="flex w-[71.653px] shrink-0 items-center gap-[8.223px]">
              <img alt="" src={`${A}/${key === 'period' ? 'f7145' : '5b17e'}.svg`} className="size-[14.108px]" />
              <span className="whitespace-nowrap">{key === 'period' ? '기간' : '장소'}</span>
            </div>
            <span className="truncate">{value}</span>
          </div>
        );
      }
      case 'assignee':
        return <AssigneeRow assignees={content.assignees} members={members} onChange={(assignees) => patchContent({ assignees })} />;
      case 'agenda': return agenda ? <AgendaSection items={agenda} /> : null;
      case 'description':
        return <SidePeekTextField label="설명" value={content.description} placeholder="설명을 입력하세요" onChange={(description) => patchContent({ description }, { debounce: true })} />;
      case 'clientMemo':
        return <SidePeekTextField label="클라이언트 메모" value={content.clientMemo} placeholder="클라이언트 메모를 입력하세요" onChange={(clientMemo) => patchContent({ clientMemo }, { debounce: true })} />;
      case 'tasks': return <TaskSubtaskSection tasks={content.tasks} members={members} onChange={(tasks) => patchContent({ tasks }, { debounce: true })} />;
      case 'links': return <LinksSection links={content.links} onChange={(links) => patchContent({ links })} />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-transparent" onClick={onClose} aria-hidden />
      <aside
        aria-label="일정 상세"
        className="side-peek-in fixed right-[24px] top-[24px] z-40 flex h-[900px] max-h-[calc(100vh-48px)] w-[540px] max-w-[calc(100vw-48px)] flex-col gap-[28px] rounded-2xl bg-surface p-[44px] leading-[normal] shadow-card max-md:right-[12px] max-md:top-[12px] max-md:h-[calc(100vh-24px)] max-md:max-h-[calc(100vh-24px)] max-md:max-w-[calc(100vw-24px)] max-md:gap-[16px] max-md:p-[24px]"
      >
        <div className="flex w-full shrink-0 items-start gap-[12px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <h2 className="text-3xl font-bold text-fg-strong">{title}</h2>
            {date ? <p className="text-sm text-fg-tertiary">{date}</p> : null}
            {store ? (
              <p role="status" className={`text-xs ${saveState === 'error' ? 'text-error' : 'text-fg-tertiary'}`}>
                {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : null}
                {saveState === 'error' ? (
                  <>
                    저장하지 못했습니다.{' '}
                    <button type="button" onClick={flush} className="underline">
                      다시 시도
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="구성 편집"
            aria-pressed={editingLayout}
            onClick={() => setEditingLayout((editing) => !editing)}
            className={`flex size-[32px] shrink-0 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-chip ${editingLayout ? 'bg-surface-chip' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="2.5" cy="8" r="1.4" />
              <circle cx="8" cy="8" r="1.4" />
              <circle cx="13.5" cy="8" r="1.4" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-[32px] overflow-y-auto">
          {notice ? <p role="alert" className="w-full rounded-md bg-surface-subtle px-[12px] py-[8px] text-xs text-fg-secondary">{notice}</p> : null}
          {loadState !== 'ready' ? (
            <div className="flex w-full flex-col items-start gap-[8px] text-sm text-fg-tertiary">
              {loadState === 'loading' ? '불러오는 중…' : (
                <>
                  <span className="text-error">일정 내용을 불러오지 못했습니다.</span>
                  <button type="button" onClick={() => setReloadTick((n) => n + 1)} className="text-xs text-fg-secondary underline">
                    다시 시도
                  </button>
                </>
              )}
            </div>
          ) : (
          <div className="flex w-full flex-col items-start gap-[24px]">
            {componentOrder.map((key) => {
              const component = PEEK_COMPONENTS.find((item) => item.key === key);
              const content = renderComponent(key);
              if (!component || content === null) return null;
              return (
                <div
                  key={key}
                  draggable={editingLayout}
                  onDragStart={(event) => startComponentDrag(event, key)}
                  onDragOver={(event) => overComponent(event, key)}
                  onDrop={(event) => dropComponent(event, key)}
                  onDragEnd={() => { setDraggedComponent(null); setDropTarget(null); }}
                  onPointerEnter={() => enterPointerDropTarget(key)}
                  onPointerUp={finishPointerDrag}
                  onPointerCancel={finishPointerDrag}
                  className={`w-full rounded-md ${editingLayout ? 'border border-dashed p-[8px]' : ''} ${
                    draggedComponent === key ? 'border-brand bg-brand-tint opacity-60' : editingLayout ? 'border-border' : ''
                  } ${dropTarget === key ? 'border-brand bg-brand-tint' : ''}`}
                >
                  {editingLayout ? (
                    <div className="mb-[8px] flex items-center gap-[8px]">
                      <span
                        aria-hidden="true"
                        onPointerDown={(event) => startPointerDrag(event, key)}
                        className="cursor-grab touch-none text-fg-tertiary active:cursor-grabbing"
                      >
                        ⠿
                      </span>
                      <span className="flex-1 text-xs font-medium text-fg-secondary">{component.label}</span>
                      <button
                        type="button"
                        aria-label={`${component.label} 구성요소 삭제`}
                        onClick={() => saveComponentOrder(componentOrder.filter((item) => item !== key))}
                        className="rounded-sm px-[6px] py-[3px] text-xs text-error-delay hover:bg-error-bg"
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                  {content}
                </div>
              );
            })}
            {editingLayout ? (
              <div className="flex w-full flex-col gap-[8px] border-t border-border pt-[12px]">
                <button
                  type="button"
                  onClick={restoreDefaults}
                  className="self-start rounded-sm px-[6px] py-[4px] text-xs text-fg-secondary hover:bg-surface-muted"
                >
                  기본 구성으로 초기화
                </button>
                <p className="m-0 text-xs font-semibold text-fg-secondary">숨긴 구성요소</p>
                {PEEK_COMPONENTS.filter((component) => !componentOrder.includes(component.key)).length ? (
                  <div className="flex flex-wrap gap-[6px]">
                    {PEEK_COMPONENTS.filter((component) => !componentOrder.includes(component.key)).map((component) => (
                      <button
                        key={component.key}
                        type="button"
                        onClick={() => saveComponentOrder([...componentOrder, component.key])}
                        className="rounded-sm border border-border px-[8px] py-[5px] text-xs text-fg hover:bg-surface-muted"
                      >
                        + {component.label}
                      </button>
                    ))}
                  </div>
                ) : <p className="m-0 text-xs text-fg-tertiary">숨긴 구성요소가 없습니다.</p>}
              </div>
            ) : null}
          </div>
          )}
        </div>
        {editingLayout ? (
          <button
            type="button"
            onClick={() => setEditingLayout(false)}
            className="mt-auto flex h-[56px] w-full shrink-0 items-center justify-center rounded-xl bg-surface-muted text-lg font-bold text-fg-strong hover:bg-surface-cell"
          >
            완료
          </button>
        ) : null}
      </aside>
    </>
  );
}
