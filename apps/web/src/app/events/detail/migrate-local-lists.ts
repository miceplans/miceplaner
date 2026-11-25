import { ApiError } from '../../../lib/api';
import { eventItemsCreate, eventListsSaveBlock, eventListsSaveProduct } from '../../../lib/api/generated/endpoints';
import type { CheckItem } from './event-checklist-model';
import type { RequestRow } from './event-products-model';
import { baseMonday, blockBody, diffTrees, isUuid, newId, productBody, withUuidIds, type CalBlock } from './event-lists-sync';

const keyOf = (eventId: string) => `miceplans.event-lists.${eventId}`;
type Saved = { schedule?: CheckItem[]; products?: RequestRow[]; calEvents?: CalBlock[] };

/** 이미 서버에 있는 id(409)는 앞선 시도에서 옮겨진 것이므로 성공으로 본다. */
const ignoreDuplicate = (error: unknown) => {
  if (error instanceof ApiError && error.status === 409) return;
  throw error;
};

/**
 * 예전에 이 브라우저에만 저장하던 행사 상세 목록을 서버로 한 번 옮긴다.
 * 먼저 id를 uuid로 바꿔 저장해 두므로 도중에 실패해도 다시 시도할 때 중복이 생기지 않는다. 모두 옮기면 저장값을 지운다.
 */
export async function migrateLocalEventLists(eventId: string, idByName: Map<string, string>): Promise<'none' | 'moved' | 'failed'> {
  let saved: Saved;
  try {
    const raw = window.localStorage.getItem(keyOf(eventId));
    if (!raw) return 'none';
    saved = JSON.parse(raw) as Saved;
  } catch {
    return 'none';
  }
  const schedule = withUuidIds(Array.isArray(saved.schedule) ? saved.schedule : []);
  const products = (Array.isArray(saved.products) ? saved.products : []).map((r) => ({ ...r, id: isUuid(r.id) ? r.id : newId() }));
  const blocks = (Array.isArray(saved.calEvents) ? saved.calEvents : [])
    .filter((b) => b.eventId === eventId)
    .map((b) => ({ ...b, id: isUuid(b.id) ? b.id : newId() }));
  if (!schedule.length && !products.length && !blocks.length) {
    window.localStorage.removeItem(keyOf(eventId));
    return 'none';
  }
  try {
    window.localStorage.setItem(keyOf(eventId), JSON.stringify({ schedule, products, calEvents: blocks }));
  } catch {
    return 'failed';
  }
  try {
    for (const op of diffTrees([], schedule)) {
      if (op.type !== 'create') continue;
      await eventItemsCreate(eventId, {
        id: op.id, kind: op.kind, parentId: op.parentId, title: op.title.trim() || '제목 없음', status: op.status, dueOn: op.dueOn,
        startMinute: op.startMinute, endMinute: op.endMinute, part: op.part ?? null, description: '', startsOn: null,
        assigneeId: op.assignee ? (idByName.get(op.assignee) ?? null) : null,
      }).catch(ignoreDuplicate);
    }
    for (const r of products) await eventListsSaveProduct(eventId, r.id, productBody(r));
    const base = baseMonday();
    for (const b of blocks) await eventListsSaveBlock(eventId, b.id, blockBody(b, base));
  } catch {
    return 'failed';
  }
  window.localStorage.removeItem(keyOf(eventId));
  return 'moved';
}
