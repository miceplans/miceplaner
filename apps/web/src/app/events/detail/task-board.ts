import type { EventItemDto } from '@miceplans/contracts';

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
