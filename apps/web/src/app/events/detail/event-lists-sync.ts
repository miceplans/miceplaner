import type { EventCalendarBlockDto, EventItemDto, EventProductDto } from '@miceplans/contracts';
import type { CheckItem } from './event-checklist-model';
import type { RequestRow } from './event-products-model';

// 행사 상세의 스케줄·할 일·제작물·캘린더 블록을 서버 데이터와 화면 상태 사이에서 바꾸고, 두 화면 상태의 차이를 API 작업으로 만든다.
// 스케줄 → 할 일 → 하위 할 일은 서버의 program → task → subtask다.

const KIND_AT = ['program', 'task', 'subtask'] as const;
type ItemKind = (typeof KIND_AT)[number];
type ItemStatus = EventItemDto['status'];

/** 화면의 시각은 오전 9시를 0으로 한 시간 단위다. 서버는 자정 기준 분으로 저장한다. */
const DAY_START_HOUR = 9;
export const toMinute = (hour: number | undefined): number | null =>
  hour === undefined ? null : Math.min(1440, Math.max(0, Math.round((DAY_START_HOUR + hour) * 60)));
export const fromMinute = (minute: number | null): number | undefined => (minute === null ? undefined : minute / 60 - DAY_START_HOUR);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID.test(id);
export const newId = () => crypto.randomUUID();

const WORKFLOW_OF: Partial<Record<ItemStatus, NonNullable<CheckItem['workflowStatus']>>> = {
  '할 일': '진행',
  '진행 중': '진행',
  '검토 대기': '검토 대기',
  보류: '보류',
  완료: '완료',
};

/** 화면 상태의 보드 열. 서버의 '할 일'과 '진행 중'은 같은 '진행'이다. */
const columnOf = (item: CheckItem): NonNullable<CheckItem['workflowStatus']> => (item.done ? '완료' : item.workflowStatus ?? '진행');

/** 새로 만들 때는 '진행'을 서버 기본값 '할 일'로, 바꿀 때는 '진행 중'으로 보낸다. */
const statusOf = (item: CheckItem, creating: boolean): ItemStatus => {
  const column = columnOf(item);
  if (column === '진행') return creating ? '할 일' : '진행 중';
  return column;
};

/**
 * 서버 항목을 스케줄 트리로 만든다. 취소된 항목과 그 하위는 빼고, 형제는 만든 순서로 둔다.
 * 상위 완료 여부는 하위 항목 기준으로 다시 계산한다(normalizeTree는 호출하는 쪽에서 한다).
 */
export function treeFromItems(items: EventItemDto[], nameOf: (userId: string) => string | undefined): CheckItem[] {
  const byParent = new Map<string | null, EventItemDto[]>();
  for (const it of items) {
    if (it.status === '취소') continue;
    const list = byParent.get(it.parentId) ?? [];
    list.push(it);
    byParent.set(it.parentId, list);
  }
  const build = (parentId: string | null, depth: number): CheckItem[] =>
    (byParent.get(parentId) ?? [])
      .filter((it) => it.kind === KIND_AT[depth])
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((it) => {
        const assignee = it.assigneeId ? nameOf(it.assigneeId) : undefined;
        const children = depth < KIND_AT.length - 1 ? build(it.id, depth + 1) : [];
        return {
          id: it.id,
          title: it.title,
          done: it.status === '완료',
          completedAt: it.completedAt ? Date.parse(it.completedAt) : undefined,
          date: it.dueOn ?? undefined,
          start: fromMinute(it.startMinute),
          end: fromMinute(it.endMinute),
          assignee,
          owner: assignee?.slice(0, 1),
          workflowStatus: WORKFLOW_OF[it.status],
          part: it.part ?? undefined,
          children: children.length ? children : undefined,
        };
      });
  return build(null, 0);
}

export type ItemOp =
  | {
      type: 'create';
      id: string;
      kind: ItemKind;
      parentId: string | null;
      title: string;
      status: ItemStatus;
      dueOn: string | null;
      startMinute: number | null;
      endMinute: number | null;
      part: CheckItem['part'] | null;
      assignee: string | undefined;
    }
  | { type: 'update'; id: string; patch: { title?: string; status?: ItemStatus; part?: CheckItem['part'] | null; startMinute?: number | null; endMinute?: number | null } }
  | { type: 'assign'; id: string; assignee: string | undefined }
  | { type: 'reschedule'; id: string; dueOn: string | null }
  | { type: 'remove'; id: string };

type Flat = { item: CheckItem; parentId: string | null; depth: number };

function flatten(items: CheckItem[]): Map<string, Flat> {
  const map = new Map<string, Flat>();
  const visit = (list: CheckItem[], parentId: string | null, depth: number) => {
    for (const item of list) {
      map.set(item.id, { item, parentId, depth });
      if (item.children?.length) visit(item.children, item.id, depth + 1);
    }
  };
  visit(items, null, 0);
  return map;
}

/**
 * 두 트리의 차이를 서버 작업으로 바꾼다. 상위가 먼저 만들어지도록 앞에서부터 순회 순서를 지킨다.
 * 하위가 있는 항목의 완료 상태는 하위에서 계산되는 값이므로 보내지 않는다(완료 처리는 서버가 담당자만 허용한다).
 * 삭제는 가장 위의 항목만 보낸다(서버가 하위를 함께 지운다).
 */
export function diffTrees(prev: CheckItem[], next: CheckItem[]): ItemOp[] {
  const before = flatten(prev);
  const after = flatten(next);
  const ops: ItemOp[] = [];
  for (const [id, { item, parentId, depth }] of after) {
    const old = before.get(id);
    if (!old) {
      if (depth >= KIND_AT.length) continue;
      ops.push({
        type: 'create',
        id,
        kind: KIND_AT[depth]!,
        parentId,
        title: item.title,
        status: statusOf(item, true),
        dueOn: item.date ?? null,
        startMinute: toMinute(item.start),
        endMinute: toMinute(item.end),
        part: item.part ?? null,
        assignee: item.assignee,
      });
      continue;
    }
    const patch: Extract<ItemOp, { type: 'update' }>['patch'] = {};
    if (item.title !== old.item.title) patch.title = item.title;
    if ((item.part ?? null) !== (old.item.part ?? null)) patch.part = item.part ?? null;
    if (toMinute(item.start) !== toMinute(old.item.start)) patch.startMinute = toMinute(item.start);
    if (toMinute(item.end) !== toMinute(old.item.end)) patch.endMinute = toMinute(item.end);
    if (!item.children?.length && columnOf(item) !== columnOf(old.item)) patch.status = statusOf(item, false);
    if (Object.keys(patch).length) ops.push({ type: 'update', id, patch });
    if ((item.assignee ?? undefined) !== (old.item.assignee ?? undefined)) ops.push({ type: 'assign', id, assignee: item.assignee });
    if ((item.date ?? null) !== (old.item.date ?? null)) ops.push({ type: 'reschedule', id, dueOn: item.date ?? null });
  }
  for (const [id, { parentId }] of before) {
    if (after.has(id)) continue;
    if (parentId && !after.has(parentId) && before.has(parentId)) continue;
    ops.push({ type: 'remove', id });
  }
  return ops;
}

/** 이 기기에 저장돼 있던 트리의 id를 uuid로 바꾼다. 이미 uuid인 id는 그대로 둔다. */
export function withUuidIds(items: CheckItem[]): CheckItem[] {
  return items.map((item) => ({
    ...item,
    id: isUuid(item.id) ? item.id : newId(),
    children: item.children ? withUuidIds(item.children) : undefined,
  }));
}

// ── 제작물 ────────────────────────────────────────────────────────────────

export const productFromDto = (p: EventProductDto): RequestRow => ({
  id: p.id, name: p.name, part: p.part, due: p.dueOn ?? '', size: p.size, qty: p.qty, material: p.material, vendor: p.vendor,
  contact: p.contact, note: p.note, negotiating: p.negotiating, status: p.status,
});

export const productBody = (r: RequestRow) => ({
  name: r.name.slice(0, 200), part: r.part, dueOn: /^\d{4}-\d{2}-\d{2}$/.test(r.due) ? r.due : null, size: r.size.slice(0, 200), qty: r.qty.slice(0, 200),
  material: r.material.slice(0, 200), vendor: r.vendor.slice(0, 200), contact: r.contact.slice(0, 200), note: r.note.slice(0, 2000),
  negotiating: r.negotiating, status: r.status,
});

/** 행 목록 차이: 새로 생기거나 바뀐 행은 저장, 사라진 행은 삭제. */
export function diffRows<T extends { id: string }>(prev: T[], next: T[], same: (a: T, b: T) => boolean): { save: T[]; remove: string[] } {
  const before = new Map(prev.map((r) => [r.id, r]));
  const after = new Set(next.map((r) => r.id));
  return {
    save: next.filter((r) => { const old = before.get(r.id); return !old || !same(old, r); }),
    remove: prev.filter((r) => !after.has(r.id)).map((r) => r.id),
  };
}

export const sameProduct = (a: RequestRow, b: RequestRow) => JSON.stringify(productBody(a)) === JSON.stringify(productBody(b));

// ── 캘린더 블록 ───────────────────────────────────────────────────────────

/** 캘린더 블록의 화면 상태. day는 기준 월요일로부터의 일수다(event-calendar의 CalEvent와 같은 모양). */
export type CalBlock = { id: string; eventId: string; day: number; title: string; start: number; end: number };

const pad = (n: number) => String(n).padStart(2, '0');
export const isoOfDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 화면이 쓰는 기준 월요일(이번 주 월요일)과 같은 날짜를 계산한다. */
export function baseMonday(now = new Date()): Date {
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t;
}

export function blockFromDto(b: EventCalendarBlockDto, base: Date): CalBlock {
  const [y, m, d] = b.date.split('-').map(Number);
  const day = Math.round((new Date(y!, m! - 1, d!).getTime() - base.getTime()) / 86_400_000);
  return { id: b.id, eventId: b.eventId, day, title: b.title, start: fromMinute(b.startMinute)!, end: fromMinute(b.endMinute)! };
}

export function blockBody(b: CalBlock, base: Date) {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + b.day);
  const startMinute = toMinute(b.start)!;
  return { title: b.title.trim().slice(0, 200) || '일정', date: isoOfDate(date), startMinute, endMinute: Math.max(startMinute + 1, toMinute(b.end)!) };
}

export const sameBlock = (a: CalBlock, b: CalBlock) => a.day === b.day && a.title === b.title && a.start === b.start && a.end === b.end;
