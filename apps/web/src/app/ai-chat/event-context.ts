import type { EventPageItem } from '@miceplans/contracts';
import type { CheckItem } from '../events/detail/event-checklist';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 행사 상세에서는 그 행사를 대화의 기본 맥락으로 보낸다. 정적 export라 상세는 `/events/detail?id=<uuid>`이다(ADR 0001).
 * useSearchParams는 레이아웃에서 Suspense 경계를 요구하므로, 전송 시점에 location에서 직접 읽는다.
 */
export const eventIdFrom = (pathname: string, search: string): string | undefined => {
  if (!/^\/events\/detail\/?$/.test(pathname)) return undefined;
  const id = new URLSearchParams(search).get('id');
  return id && UUID.test(id) ? id : undefined;
};

/** 행사 상세가 지금 보여 주는 탭. 패널은 레이아웃에 있어 페이지 상태를 직접 못 보므로, 상세 화면이 여기에 기록한다. */
let currentTab: string | undefined;
export const setEventTab = (tab: string | undefined) => { currentTab = tab; };
export const getEventTab = () => currentTab;

/** 스케줄 → 할 일 → 하위 할 일 트리를 에이전트에 보낼 평면 목록으로 바꾼다. */
const LEVELS = ['schedule', 'task', 'subtask'] as const;
const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);
export const flattenEventItems = (items: readonly CheckItem[], limit = 300): EventPageItem[] => {
  const out: EventPageItem[] = [];
  const walk = (list: readonly CheckItem[], depth: number, parent: string | null) => {
    for (const item of list) {
      if (out.length >= limit) return;
      out.push({
        level: LEVELS[Math.min(depth, 2)]!,
        title: clip(item.title, 200),
        assignee: item.assignee ? clip(item.assignee, 50) : null,
        status: item.workflowStatus ?? (item.done ? '완료' : '진행'),
        date: item.date ? clip(item.date, 40) : null,
        part: item.part ?? null,
        parent: parent ? clip(parent, 200) : null,
      });
      if (item.children?.length) walk(item.children, depth + 1, item.title);
    }
  };
  walk(items, 0, null);
  return out;
};

/** 행사 상세가 지금 보여 주는 스케줄·할 일. 탭과 같은 이유로 상세 화면이 기록한다. */
let currentItems: EventPageItem[] | undefined;
export const setEventItems = (items: readonly CheckItem[] | undefined) => { currentItems = items ? flattenEventItems(items) : undefined; };
export const getEventItems = () => currentItems;
