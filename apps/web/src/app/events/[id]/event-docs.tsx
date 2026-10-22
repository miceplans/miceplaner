'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@miceplans/ui';

import { matchPart, type PartFilter, type ProductPart } from './event-parts';

/*
 * 행사 문서 — 실시간 공동작업 (UI 단계)
 *
 * 서버(Hocuspocus)가 붙기 전까지는 같은 브라우저의 여러 탭·창 사이에서 BroadcastChannel로 동기화한다.
 * 문서는 블록 단위 CRDT(LWW-element)로 병합한다: 블록마다 (ts, by)로 최신 수정이 이기고, 삭제는 tombstone,
 * 순서는 실수 위치값(pos)으로 정한다. 서로 다른 블록을 동시에 고치면 모두 보존된다.
 * 3단계에서 TipTap + Yjs + Hocuspocus로 교체하며 이 파일의 저장소·전송 계층만 바꾸면 된다.
 */

type BlockType = 'h1' | 'h2' | 'p' | 'todo' | 'bullet';
type Block = { id: string; type: BlockType; text: string; checked?: boolean; pos: number; ts: number; by: string; deleted?: boolean };
type Doc = {
  id: string;
  title: string;
  titleTs: number;
  titleBy: string;
  createdTs: number;
  updatedTs: number;
  part?: ProductPart;
  deletedTs?: number;
  deletedBy?: string;
  blocks: Block[];
};
type Presence = { clientId: string; name: string; color: string; docId: string | null; blockId: string | null; seen: number };
type Msg =
  | { type: 'doc'; doc: Doc }
  | { type: 'sync'; docs: Doc[] }
  | { type: 'sync-req' }
  | { type: 'presence'; presence: Omit<Presence, 'seen'> }
  | { type: 'leave'; clientId: string };

const BLOCK_MENU: { type: BlockType; label: string; hint: string }[] = [
  { type: 'p', label: '텍스트', hint: '일반 문단' },
  { type: 'h1', label: '제목 1', hint: '큰 제목' },
  { type: 'h2', label: '제목 2', hint: '중간 제목' },
  { type: 'todo', label: '할 일', hint: '체크박스 목록' },
  { type: 'bullet', label: '글머리 기호', hint: '목록' },
];

const PEOPLE = ['지민', '하준', '서윤', '도윤', '아린', '시우', '유나', '이안'];
// avatarPalette 4색에 대응하는 토큰 클래스 + 딥 핑크(임의 색상 미사용).
const COLORS = ['bg-brand-green', 'bg-brand-blue', 'bg-brand-pink', 'bg-brand-amber', 'bg-brand-deep'];
const HEARTBEAT_MS = 2000;
const PRESENCE_TTL_MS = 6000;

const seedBlock = (docId: string, n: number, type: BlockType, text: string, checked?: boolean): Block => ({
  id: `${docId}-b${n}`, type, text, checked, pos: n, ts: 1, by: 'seed',
});

const seedDocs = (): Doc[] => [
  {
    id: 'd1', title: '운영 체크리스트', titleTs: 1, titleBy: 'seed', createdTs: 2, updatedTs: 1,
    blocks: [
      seedBlock('d1', 1, 'p', '행사 전·당일 운영에 필요한 항목을 팀원과 함께 정리합니다.'),
      seedBlock('d1', 2, 'h2', '사전 준비'),
      seedBlock('d1', 3, 'todo', '참가 업체 부스 배치도 확정', true),
      seedBlock('d1', 4, 'todo', '운영 인력 배치표 공유', false),
      seedBlock('d1', 5, 'bullet', '인쇄물은 3월 6일까지 입고'),
    ],
  },
  {
    id: 'd2', title: '회의록 · 3월 4일', titleTs: 1, titleBy: 'seed', createdTs: 1, updatedTs: 1, part: '디자인',
    blocks: [seedBlock('d2', 1, 'p', '브로슈어 인쇄 일정과 현장 리허설 동선을 논의했습니다.')],
  },
  {
    id: 'd3', title: '오프닝 영상 콘티', titleTs: 1, titleBy: 'seed', createdTs: 3, updatedTs: 1, part: '영상',
    blocks: [
      seedBlock('d3', 1, 'p', '행사 오프닝 영상 30초 콘티 초안입니다.'),
      seedBlock('d3', 2, 'h2', '콘티 구성'),
      seedBlock('d3', 3, 'todo', '1안 내레이션 확정', false),
      seedBlock('d3', 4, 'bullet', 'BGM 후보 3곳 전달'),
    ],
  },
];

const newer = (a: { ts: number; by: string }, b: { ts: number; by: string }) => b.ts > a.ts || (b.ts === a.ts && b.by > a.by);

function mergeDoc(a: Doc, b: Doc): Doc {
  const blocks = new Map(a.blocks.map((x) => [x.id, x]));
  for (const incoming of b.blocks) {
    const cur = blocks.get(incoming.id);
    if (!cur || newer(cur, incoming)) blocks.set(incoming.id, incoming);
  }
  const titleWins = newer({ ts: a.titleTs, by: a.titleBy }, { ts: b.titleTs, by: b.titleBy });
  // 문서 삭제도 최신 (deletedTs, deletedBy)가 이긴다.
  const delWins = newer({ ts: a.deletedTs ?? 0, by: a.deletedBy ?? '' }, { ts: b.deletedTs ?? 0, by: b.deletedBy ?? '' });
  return {
    id: a.id,
    title: titleWins ? b.title : a.title,
    titleTs: titleWins ? b.titleTs : a.titleTs,
    titleBy: titleWins ? b.titleBy : a.titleBy,
    part: a.part ?? b.part,
    deletedTs: delWins ? b.deletedTs : a.deletedTs,
    deletedBy: delWins ? b.deletedBy : a.deletedBy,
    createdTs: Math.min(a.createdTs, b.createdTs),
    updatedTs: Math.max(a.updatedTs, b.updatedTs),
    blocks: [...blocks.values()],
  };
}

function mergeDocs(list: Doc[], incoming: Doc[]): Doc[] {
  const map = new Map(list.map((d) => [d.id, d]));
  for (const d of incoming) {
    const cur = map.get(d.id);
    map.set(d.id, cur ? mergeDoc(cur, d) : d);
  }
  return [...map.values()].sort((x, y) => y.createdTs - x.createdTs);
}

const visibleBlocks = (doc: Doc) => doc.blocks.filter((b) => !b.deleted).sort((x, y) => x.pos - y.pos || (x.id < y.id ? -1 : 1));

function relTime(ts: number, now: number) {
  if (ts <= 1) return '저장됨';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return '방금 전';
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
}

function readStored(key: string): Doc[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Doc[];
  } catch {
    // 저장소를 쓸 수 없으면 기본 문서로 시작한다.
  }
  return [];
}

function useCollab(eventId: string) {
  const storageKey = `miceplans.event-docs.v2.${eventId}`;
  const [docs, setDocs] = useState<Doc[]>(seedDocs);
  const [peers, setPeers] = useState<Presence[]>([]);
  const [me, setMe] = useState<{ clientId: string; name: string; color: string } | null>(null);
  const docsRef = useRef(docs);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastTs = useRef(0);
  const location = useRef<{ docId: string | null; blockId: string | null }>({ docId: null, blockId: null });

  const stamp = useCallback(() => {
    lastTs.current = Math.max(Date.now(), lastTs.current + 1);
    return lastTs.current;
  }, []);

  const persist = useCallback((next: Doc[]) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // 저장 실패는 화면 상태에만 영향을 주므로 무시한다.
    }
  }, [storageKey]);

  const commit = useCallback((next: Doc[]) => {
    docsRef.current = next;
    setDocs(next);
    persist(next);
  }, [persist]);

  // 내 정체성: 탭마다 다른 이름·색. 새로고침해도 유지되도록 sessionStorage에 둔다.
  useEffect(() => {
    let identity: { clientId: string; name: string; color: string } | null = null;
    try {
      const raw = window.sessionStorage.getItem('miceplans.collab-identity');
      if (raw) identity = JSON.parse(raw);
    } catch {
      // 무시
    }
    if (!identity) {
      const clientId = `c${Math.random().toString(36).slice(2, 8)}`;
      identity = { clientId, name: PEOPLE[Math.floor(Math.random() * PEOPLE.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] };
      try {
        window.sessionStorage.setItem('miceplans.collab-identity', JSON.stringify(identity));
      } catch {
        // 무시
      }
    }
    setMe(identity);
  }, []);

  useEffect(() => {
    if (!me) return;
    commit(mergeDocs(docsRef.current, readStored(storageKey)));

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`miceplans-docs-${eventId}`);
    channelRef.current = channel;
    const send = (msg: Msg) => channel?.postMessage(msg);
    const sendPresence = () => send({ type: 'presence', presence: { clientId: me.clientId, name: me.name, color: me.color, ...location.current } });

    if (channel) {
      channel.onmessage = (ev: MessageEvent<Msg>) => {
        const msg = ev.data;
        if (msg.type === 'doc') commit(mergeDocs(docsRef.current, [msg.doc]));
        else if (msg.type === 'sync') commit(mergeDocs(docsRef.current, msg.docs));
        else if (msg.type === 'sync-req') { send({ type: 'sync', docs: docsRef.current }); sendPresence(); }
        else if (msg.type === 'presence') {
          setPeers((list) => [...list.filter((p) => p.clientId !== msg.presence.clientId), { ...msg.presence, seen: Date.now() }]);
        } else if (msg.type === 'leave') setPeers((list) => list.filter((p) => p.clientId !== msg.clientId));
      };
      send({ type: 'sync-req' });
    }
    sendPresence();

    const beat = window.setInterval(() => {
      sendPresence();
      setPeers((list) => list.filter((p) => Date.now() - p.seen < PRESENCE_TTL_MS));
    }, HEARTBEAT_MS);
    const onUnload = () => send({ type: 'leave', clientId: me.clientId });
    window.addEventListener('pagehide', onUnload);

    return () => {
      window.clearInterval(beat);
      window.removeEventListener('pagehide', onUnload);
      onUnload();
      channel?.close();
      channelRef.current = null;
    };
  }, [me, eventId, storageKey, commit]);

  const broadcastDoc = (doc: Doc) => channelRef.current?.postMessage({ type: 'doc', doc } satisfies Msg);

  const mutate = (docId: string, fn: (doc: Doc, ts: number, by: string) => Doc) => {
    if (!me) return;
    const ts = stamp();
    const next = docsRef.current.map((d) => (d.id === docId ? { ...fn(d, ts, me.clientId), updatedTs: ts } : d));
    commit(next);
    const changed = next.find((d) => d.id === docId);
    if (changed) broadcastDoc(changed);
  };

  const setLocation = (docId: string | null, blockId: string | null) => {
    location.current = { docId, blockId };
    if (me) channelRef.current?.postMessage({ type: 'presence', presence: { clientId: me.clientId, name: me.name, color: me.color, docId, blockId } } satisfies Msg);
  };

  const api = {
    editBlock: (docId: string, blockId: string, patch: Partial<Pick<Block, 'type' | 'text' | 'checked'>>) =>
      mutate(docId, (d, ts, by) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch, ts, by } : b)) })),
    insertAfter: (docId: string, afterId: string | null, block: Pick<Block, 'type' | 'text' | 'checked'>) => {
      const id = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      mutate(docId, (d, ts, by) => {
        const list = visibleBlocks(d);
        const idx = afterId ? list.findIndex((b) => b.id === afterId) : -1;
        const prev = idx >= 0 ? list[idx].pos : (list[0]?.pos ?? 1) - 1;
        const next = list[idx + 1]?.pos ?? prev + 1;
        return { ...d, blocks: [...d.blocks, { id, ...block, pos: (prev + next) / 2, ts, by }] };
      });
      return id;
    },
    removeBlock: (docId: string, blockId: string) =>
      mutate(docId, (d, ts, by) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, deleted: true, ts, by } : b)) })),
    deleteDoc: (docId: string) => mutate(docId, (d, ts, by) => ({ ...d, deletedTs: ts, deletedBy: by })),
    setTitle: (docId: string, title: string) => mutate(docId, (d, ts, by) => ({ ...d, title, titleTs: ts, titleBy: by })),
    createDoc: () => {
      if (!me) return null;
      const ts = stamp();
      const id = `d${ts.toString(36)}${me.clientId}`;
      const doc: Doc = { id, title: '', titleTs: ts, titleBy: me.clientId, createdTs: ts, updatedTs: ts, blocks: [{ id: `${id}-b1`, type: 'p', text: '', pos: 1, ts, by: me.clientId }] };
      commit(mergeDocs(docsRef.current, [doc]));
      broadcastDoc(doc);
      return id;
    },
    setLocation,
  };

  return { docs, peers, me, ...api };
}

function Avatar({ name, color, size = 24, ring = true }: { name: string; color: string; size?: number; ring?: boolean }) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-fg-inverse ${color} ${ring ? 'border-2 border-solid border-surface' : ''}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

function BlockInput({
  block,
  inputRef,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
}: {
  block: Block;
  inputRef: (el: HTMLTextAreaElement | null) => void;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text, block.type]);

  const style =
    block.type === 'h1' ? 'text-2xl font-bold leading-[1.3]' : block.type === 'h2' ? 'text-lg font-semibold leading-[1.45]' : 'text-md leading-[1.6]';

  return (
    <textarea
      ref={(el) => { ref.current = el; inputRef(el); }}
      rows={1}
      value={block.text}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ''))}
      onKeyDown={onKeyDown}
      className={`block min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-fg outline-none placeholder:text-fg-tertiary ${style} ${
        block.type === 'todo' && block.checked ? 'text-fg-tertiary line-through' : ''
      }`}
    />
  );
}

type Collab = ReturnType<typeof useCollab>;

export type DocVisibility = '전체 공개' | '행사 멤버' | 'PM·AM만';

const VISIBILITIES: DocVisibility[] = ['전체 공개', '행사 멤버', 'PM·AM만'];
const DEFAULT_VISIBILITY: DocVisibility = '행사 멤버';
const VISIBILITY_TONE: Record<DocVisibility, string> = {
  '전체 공개': 'bg-success-bg text-success-deep',
  '행사 멤버': 'bg-brand-tint text-brand',
  'PM·AM만': 'bg-surface-chip text-fg-secondary',
};

function VisibilityChip({ value }: { value: DocVisibility }) {
  return (
    <span className={`flex h-[22px] shrink-0 items-center rounded-full px-[8px] text-2xs font-semibold ${VISIBILITY_TONE[value]}`}>
      {value}
    </span>
  );
}

function DocPanel({
  doc,
  collab,
  visibility,
  onClose,
}: {
  doc: Doc;
  collab: Collab;
  visibility: DocVisibility;
  onClose: () => void;
}) {
  const { me, peers } = collab;
  const refs = useRef(new Map<string, HTMLTextAreaElement | null>());
  const pendingFocus = useRef<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const blocks = visibleBlocks(doc);
  const here = peers.filter((p) => p.docId === doc.id);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    collab.setLocation(doc.id, null);
    return () => collab.setLocation(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, me?.clientId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (pendingFocus.current) {
      const el = refs.current.get(pendingFocus.current);
      if (el) { el.focus(); pendingFocus.current = null; }
    }
  });

  const apply = (block: Block, type: BlockType) => {
    collab.editBlock(doc.id, block.id, { type, text: '', checked: type === 'todo' ? false : undefined });
    setMenuFor(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (menuFor === block.id) {
        const q = block.text.slice(1).toLowerCase();
        const match = BLOCK_MENU.find((m) => !q || m.label.includes(q) || m.type.startsWith(q));
        if (match) apply(block, match.type);
        return;
      }
      // 빈 목록 항목에서 Enter 하면 일반 문단으로 돌아간다.
      if ((block.type === 'todo' || block.type === 'bullet') && !block.text) {
        collab.editBlock(doc.id, block.id, { type: 'p', checked: undefined });
        return;
      }
      const keep = block.type === 'todo' || block.type === 'bullet';
      pendingFocus.current = collab.insertAfter(doc.id, block.id, { type: keep ? block.type : 'p', text: '', checked: block.type === 'todo' ? false : undefined });
    } else if (e.key === 'Backspace' && !block.text && blocks.length > 1) {
      e.preventDefault();
      pendingFocus.current = (blocks[index - 1] ?? blocks[index + 1]).id;
      collab.removeBlock(doc.id, block.id);
    } else if (e.key === 'ArrowUp' && index > 0 && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      refs.current.get(blocks[index - 1].id)?.focus();
    } else if (e.key === 'ArrowDown' && index < blocks.length - 1 && e.currentTarget.selectionStart === block.text.length) {
      e.preventDefault();
      refs.current.get(blocks[index + 1].id)?.focus();
    } else if (e.key === 'Escape' && menuFor) {
      e.stopPropagation();
      setMenuFor(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-transparent" onClick={onClose} aria-hidden />
      <aside aria-label="문서" className="side-peek-in fixed right-[24px] top-[96px] z-40 flex h-[694px] max-h-[calc(100vh-112px)] w-[560px] max-w-full flex-col rounded-2xl bg-surface shadow-card">
        <div className="flex items-center gap-[10px] border-0 border-b border-solid border-border-soft px-[28px] py-[14px]">
          <div className="flex items-center" aria-label="현재 접속자">
            {me && <Avatar name={me.name} color={me.color} />}
            {here.map((p) => (
              <span key={p.clientId} style={{ marginLeft: -6 }}><Avatar name={p.name} color={p.color} /></span>
            ))}
          </div>
          <span className="text-xs text-fg-secondary" role="status">
            {here.length ? `${here.map((p) => p.name).join(', ')} 님과 함께 편집 중` : '나만 보고 있어요'}
          </span>
          <VisibilityChip value={visibility} />
          <span className="flex-1" />
          <span className="text-xs text-fg-tertiary">자동 저장됨 · {relTime(doc.updatedTs, now)}</span>
          <button type="button" aria-label="문서 닫기" onClick={onClose} className="flex size-[28px] items-center justify-center rounded-md text-lg text-fg-secondary hover:bg-surface-chip">×</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[40px] py-[24px]">
          <input
            value={doc.title}
            onChange={(e) => collab.setTitle(doc.id, e.target.value)}
            aria-label="문서 제목"
            placeholder="제목 없음"
            className="mb-[16px] w-full border-0 bg-transparent p-0 text-3xl font-bold text-fg outline-none placeholder:text-fg-tertiary"
          />
          <div className="flex flex-col gap-[4px]">
            {blocks.map((block, index) => {
              const editors = here.filter((p) => p.blockId === block.id);
              return (
                <div key={block.id} className="group relative flex items-start gap-[8px]">
                  {editors.map((p, i) => (
                    <span key={p.clientId} style={{ top: 2 + i * 18 }} className={`absolute -left-[34px] rounded-sm px-[4px] text-[9px] font-semibold leading-[16px] text-fg-inverse ${p.color}`}>{p.name}</span>
                  ))}
                  {editors[0] && <span className={`pointer-events-none absolute inset-y-0 -left-[6px] w-[2px] rounded-full ${editors[0].color}`} />}
                  {block.type === 'todo' && (
                    <input type="checkbox" checked={!!block.checked} onChange={() => collab.editBlock(doc.id, block.id, { checked: !block.checked })} aria-label="할 일 완료" className="mt-[5px] size-[16px] shrink-0 accent-brand" />
                  )}
                  {block.type === 'bullet' && <span className="mt-[9px] size-[5px] shrink-0 rounded-full bg-fg" />}
                  <BlockInput
                    block={block}
                    inputRef={(el) => { if (el) refs.current.set(block.id, el); else refs.current.delete(block.id); }}
                    placeholder={block.type === 'p' ? "'/' 로 블록 선택" : ''}
                    onFocus={() => collab.setLocation(doc.id, block.id)}
                    onChange={(text) => {
                      setMenuFor(text.startsWith('/') && block.type === 'p' ? block.id : null);
                      collab.editBlock(doc.id, block.id, { text });
                    }}
                    onKeyDown={(e) => onKeyDown(e, block, index)}
                  />
                  {menuFor === block.id && (
                    <ul className="absolute left-0 top-full z-10 m-0 mt-[4px] w-[220px] list-none rounded-lg border border-solid border-border bg-surface p-[4px] shadow-card">
                      {BLOCK_MENU.filter((m) => !block.text.slice(1) || m.label.includes(block.text.slice(1)) || m.type.startsWith(block.text.slice(1).toLowerCase())).map((m) => (
                        <li key={m.type}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { apply(block, m.type); refs.current.get(block.id)?.focus(); }}
                            className="flex w-full items-center justify-between rounded-md px-[8px] py-[6px] text-left text-sm text-fg hover:bg-surface-sunken"
                          >
                            {m.label}
                            <span className="text-2xs text-fg-tertiary">{m.hint}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    aria-label="블록 삭제"
                    onClick={() => setDeletingBlock(block.id)}
                    className="mt-[6px] flex size-[22px] shrink-0 items-center justify-center rounded-md text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
      {deletingBlock && (
        <ConfirmDialog
          title="블록을 삭제할까요?"
          body="삭제한 블록은 복구할 수 없습니다."
          onClose={() => setDeletingBlock(null)}
          onConfirm={() => {
            collab.removeBlock(doc.id, deletingBlock);
            setDeletingBlock(null);
          }}
        />
      )}
    </>
  );
}

/** canManage: PM·AM만 문서 열람 범위를 바꿀 수 있다 (docs/functional-specification.md 위키 수용 기준). */
export function EventDocs({ eventId, part = '전체', canManage = false }: { eventId: string; part?: PartFilter; canManage?: boolean }) {
  const collab = useCollab(eventId);
  const { docs, peers } = collab;
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // 열람 인원 설정은 목업 상태로 컴포넌트 state만 유지한다. 서버 연동 시 문서 메타로 옮긴다.
  const [visibilityByDoc, setVisibilityByDoc] = useState<Record<string, DocVisibility>>({});
  const visibilityKey = `miceplans.docs.visibility.${eventId}`;

  // 새로고침 후에도 유지: hydration 이후 저장값을 복원하고, 알 수 없는 값은 버린다.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(visibilityKey);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        const next: Record<string, DocVisibility> = {};
        for (const [id, v] of Object.entries(parsed)) {
          if ((VISIBILITIES as readonly string[]).includes(v as string)) next[id] = v as DocVisibility;
        }
        setVisibilityByDoc(next);
      }
    } catch {
      // 저장값을 읽을 수 없으면 기본 공개 범위를 쓴다.
    }
    setRestored(true);
  }, [visibilityKey]);

  const changeVisibility = (docId: string, value: DocVisibility) =>
    setVisibilityByDoc((prev) => {
      const next = { ...prev, [docId]: value };
      try {
        window.localStorage.setItem(visibilityKey, JSON.stringify(next));
      } catch {
        // localStorage를 쓸 수 없는 환경에서는 세션 동안만 반영한다.
      }
      return next;
    });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const openDoc = docs.find((d) => d.id === openId) ?? null;
  const visibleDocs = matchPart(
    docs.filter((d) => !d.deletedTs),
    part,
  );
  const deletingDoc = deletingId ? (docs.find((d) => d.id === deletingId) ?? null) : null;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex w-full flex-col gap-[8px] py-[12px]">
      <ul className="m-0 flex w-full list-none flex-col p-0">
        {visibleDocs.map((d) => {
          const viewers = peers.filter((p) => p.docId === d.id);
          const visibility = visibilityByDoc[d.id] ?? DEFAULT_VISIBILITY;
          return (
            <li key={d.id} className="flex h-[44px] items-center gap-[10px] rounded-md px-[8px] hover:bg-surface-sunken">
              <button type="button" onClick={() => setOpenId(d.id)} className="flex min-w-0 flex-1 items-center gap-[10px] text-left">
                <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-fg-tertiary"><path d="M4 1.75h5.5L12.5 4.75V14.25H4V1.75Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M6 8h4.5M6 10.5h4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                <span className="truncate text-base font-medium text-fg">{d.title || '제목 없음'}</span>
                {d.part && <span className="shrink-0 rounded-md bg-surface-chip px-[6px] py-px text-2xs font-semibold text-fg-secondary">{d.part}</span>}
              </button>
              {/* 저장값 복원 전에는 기본값이 잠깐 비치지 않도록 자리만 유지한다. */}
              <span className={restored ? '' : 'invisible'}>
                <VisibilityChip value={visibility} />
              </span>
              <select
                aria-label="열람 인원 설정"
                value={visibility}
                disabled={!canManage}
                title={canManage ? undefined : 'PM·AM만 열람 범위를 바꿀 수 있습니다'}
                onChange={(e) => changeVisibility(d.id, e.target.value as DocVisibility)}
                className={`h-[28px] shrink-0 rounded-sm border border-solid border-border bg-surface px-[6px] text-xs text-fg-secondary disabled:cursor-not-allowed disabled:opacity-60 ${restored ? '' : 'invisible'}`}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              {viewers.length > 0 && (
                <span className="flex shrink-0 items-center" aria-label={`${viewers.map((v) => v.name).join(', ')} 편집 중`}>
                  {viewers.map((v, i) => (
                    <span key={v.clientId} style={{ marginLeft: i ? -6 : 0 }}><Avatar name={v.name} color={v.color} size={20} /></span>
                  ))}
                </span>
              )}
              <span className="w-[72px] shrink-0 text-right text-sm text-fg-tertiary">{relTime(d.updatedTs, now)}</span>
              <button
                type="button"
                aria-label={`${d.title || '제목 없음'} 문서 삭제`}
                onClick={() => setDeletingId(d.id)}
                className="flex size-[24px] shrink-0 items-center justify-center rounded-md text-fg-tertiary hover:bg-surface-chip"
              >
                ×
              </button>
            </li>
          );
        })}
        {!visibleDocs.length && <li className="px-[8px] py-[12px] text-base text-fg-tertiary">해당 파트의 문서가 없습니다.</li>}
      </ul>
      <button
        type="button"
        onClick={() => { const id = collab.createDoc(); if (id) setOpenId(id); }}
        className="flex h-[36px] items-center gap-[10px] pl-[8px] text-base text-fg-tertiary hover:text-fg-secondary"
      >
        <span className="flex size-[14px] items-center justify-center">+</span>
        새 문서
      </button>

      {openDoc && <DocPanel key={openDoc.id} doc={openDoc} collab={collab} visibility={visibilityByDoc[openDoc.id] ?? DEFAULT_VISIBILITY} onClose={() => setOpenId(null)} />}

      {deletingDoc && (
        <ConfirmDialog
          title={`'${deletingDoc.title || '제목 없음'}' 문서를 삭제할까요?`}
          body="문서 안의 모든 블록이 함께 삭제되며 복구할 수 없습니다."
          onClose={() => setDeletingId(null)}
          onConfirm={() => {
            collab.deleteDoc(deletingDoc.id);
            if (openId === deletingDoc.id) setOpenId(null);
            setDeletingId(null);
          }}
        />
      )}
    </div>
  );
}
