import type { EventItemDto } from '@miceplans/contracts';
import type { CheckItem } from './event-checklist-model';
import type { RequestRow } from './event-products-model';

export type BoardColumnKey = '진행' | '검토 대기' | '완료' | '보류';

/** 보드 열과 항목 상태의 대응. '할 일'은 진행 열에 함께 두고 '취소'는 보드에 표시하지 않는다. */
const COLUMN_OF: Partial<Record<EventItemDto['status'], BoardColumnKey>> = {
  '할 일': '진행',
  '진행 중': '진행',
  '검토 대기': '검토 대기',
  완료: '완료',
  보류: '보류',
};

export const BOARD_COLUMNS: BoardColumnKey[] = ['진행', '검토 대기', '완료', '보류'];

export type BoardItem = {
  id: string;
  title: string;
  column: BoardColumnKey;
  meta: string;
  completedAt?: string | number | null;
  due?: string | null;
  source: 'task' | '제작물';
};

function localTaskItems(schedules: CheckItem[]): BoardItem[] {
  const result: BoardItem[] = [];
  const visit = (items: CheckItem[], depth: number) => {
    for (const item of items) {
      if (depth > 0) {
        const column = item.done ? '완료' : item.workflowStatus ?? '진행';
        result.push({ id: `local:${item.id}`, title: item.title, column, meta: item.date ? `마감 ${item.date}` : '마감일 없음', completedAt: item.completedAt, due: item.date, source: 'task' });
      }
      if (item.children?.length) visit(item.children, depth + 1);
    }
  };
  visit(schedules, 0);
  return result;
}

const REQUEST_COLUMN: Record<RequestRow['status'], BoardColumnKey> = { draft: '진행', pending: '검토 대기', success: '완료', reject: '보류' };

export function buildBoardItems(serverItems: EventItemDto[], schedules: CheckItem[] = [], products: RequestRow[] = []): BoardItem[] {
  const server = serverItems.filter((item) => item.kind === 'task' && COLUMN_OF[item.status]).map((item) => ({
    id: item.id,
    title: item.title,
    column: COLUMN_OF[item.status]!,
    meta: taskMeta(item),
    completedAt: item.completedAt ?? item.updatedAt,
    due: item.dueOn,
    source: 'task' as const,
  }));
  const productItems = products.filter((row) => row.name.trim()).map((row) => ({
    id: `product:${row.id}`,
    title: row.name,
    column: REQUEST_COLUMN[row.status],
    meta: row.due ? `마감 ${row.due}` : '마감일 없음',
    due: row.due,
    source: '제작물' as const,
  }));
  return [...server, ...localTaskItems(schedules), ...productItems];
}

export function groupBoardItems(items: BoardItem[]): Record<BoardColumnKey, BoardItem[]> {
  const groups: Record<BoardColumnKey, BoardItem[]> = { 진행: [], '검토 대기': [], 완료: [], 보류: [] };
  for (const item of items) groups[item.column].push(item);
  const completedTime = (value: string | number | null | undefined) => typeof value === 'number' ? value : value ? Date.parse(value) : 0;
  for (const col of BOARD_COLUMNS) groups[col].sort(col === '완료'
    ? (a, b) => completedTime(b.completedAt) - completedTime(a.completedAt)
    : (a, b) => (a.due ?? '9999-12-31').localeCompare(b.due ?? '9999-12-31'));
  return groups;
}

/**
 * Task를 보드 열로 묶는다. 완료 열은 최근 완료 순, 나머지는 마감일이 이른 순(마감일 없는 항목은 뒤)이다.
 */
export function groupTasks(items: EventItemDto[]): Record<BoardColumnKey, EventItemDto[]> {
  const groups: Record<BoardColumnKey, EventItemDto[]> = { 진행: [], '검토 대기': [], 완료: [], 보류: [] };
  for (const item of items) {
    if (item.kind !== 'task') continue;
    const col = COLUMN_OF[item.status];
    if (col) groups[col].push(item);
  }
  const byDue = (a: EventItemDto, b: EventItemDto) => (a.dueOn ?? '9999-12-31').localeCompare(b.dueOn ?? '9999-12-31');
  for (const col of BOARD_COLUMNS) {
    groups[col].sort(col === '완료' ? (a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt) : byDue);
  }
  return groups;
}

const md = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}`;
};

/** 카드 보조 문구. 완료 항목은 완료일, 나머지는 마감일을 보여 준다. */
export function taskMeta(item: EventItemDto): string {
  if (item.status === '완료') return `완료 ${md(item.completedAt ?? item.updatedAt)}`;
  return item.dueOn ? `마감 ${md(item.dueOn)}` : '마감일 없음';
}
