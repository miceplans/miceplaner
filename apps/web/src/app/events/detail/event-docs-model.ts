/*
 * 행사 문서 — 실시간 공동작업 (UI 단계)
 *
 * 서버(Hocuspocus)가 붙기 전까지는 같은 브라우저의 여러 탭·창 사이에서 BroadcastChannel로 동기화한다.
 * 문서는 블록 단위 CRDT(LWW-element)로 병합한다: 블록마다 (ts, by)로 최신 수정이 이기고, 삭제는 tombstone,
 * 순서는 실수 위치값(pos)으로 정한다. 서로 다른 블록을 동시에 고치면 모두 보존된다.
 * 3단계에서 TipTap + Yjs + Hocuspocus로 교체하며 저장소·전송 계층(use-event-docs-collab)만 바꾸면 된다.
 */

import type { ProductPart } from './event-parts';

export type BlockType = 'h1' | 'h2' | 'p' | 'todo' | 'bullet';
export type Block = { id: string; type: BlockType; text: string; checked?: boolean; pos: number; ts: number; by: string; deleted?: boolean };
export type Doc = {
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
export type Presence = { clientId: string; name: string; color: string; docId: string | null; blockId: string | null; seen: number };
export type Msg =
  | { type: 'doc'; doc: Doc }
  | { type: 'sync'; docs: Doc[] }
  | { type: 'sync-req' }
  | { type: 'presence'; presence: Omit<Presence, 'seen'> }
  | { type: 'leave'; clientId: string };

export const BLOCK_MENU: { type: BlockType; label: string; hint: string }[] = [
  { type: 'p', label: '텍스트', hint: '일반 문단' },
  { type: 'h1', label: '제목 1', hint: '큰 제목' },
  { type: 'h2', label: '제목 2', hint: '중간 제목' },
  { type: 'todo', label: '할 일', hint: '체크박스 목록' },
  { type: 'bullet', label: '글머리 기호', hint: '목록' },
];

// avatarPalette 4색에 대응하는 토큰 클래스 + 딥 핑크(임의 색상 미사용).
export const COLORS = ['bg-brand-green', 'bg-brand-blue', 'bg-brand-pink', 'bg-brand-amber', 'bg-brand-deep'];
export const HEARTBEAT_MS = 2000;
export const PRESENCE_TTL_MS = 6000;

export const seedDocs = (): Doc[] => [];

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

export function mergeDocs(list: Doc[], incoming: Doc[]): Doc[] {
  const map = new Map(list.map((d) => [d.id, d]));
  for (const d of incoming) {
    const cur = map.get(d.id);
    map.set(d.id, cur ? mergeDoc(cur, d) : d);
  }
  return [...map.values()].sort((x, y) => y.createdTs - x.createdTs);
}

export const visibleBlocks = (doc: Doc) => doc.blocks.filter((b) => !b.deleted).sort((x, y) => x.pos - y.pos || (x.id < y.id ? -1 : 1));

export function relTime(ts: number, now: number) {
  if (ts <= 1) return '저장됨';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return '방금 전';
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return new Date(ts).toLocaleDateString('ko-KR');
}

export function readStored(key: string): Doc[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Doc[];
  } catch {
    // 저장소를 쓸 수 없으면 기본 문서로 시작한다.
  }
  return [];
}

export type DocVisibility = '전체 공개' | '행사 멤버' | 'PM·AM만';

export const VISIBILITIES: DocVisibility[] = ['전체 공개', '행사 멤버', 'PM·AM만'];
export const DEFAULT_VISIBILITY: DocVisibility = '행사 멤버';
export const VISIBILITY_TONE: Record<DocVisibility, string> = {
  '전체 공개': 'bg-success-bg text-success-deep',
  '행사 멤버': 'bg-brand-tint text-brand',
  'PM·AM만': 'bg-surface-chip text-fg-secondary',
};
