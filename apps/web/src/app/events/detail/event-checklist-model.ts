import type { ProductPart } from './event-parts';

export type CheckItem = {
  id: string;
  title: string;
  done: boolean;
  /** 완료 처리한 시각(ms). 완료일 순 정렬에 쓴다. 없으면 마감일로 대신한다. */
  completedAt?: number;
  date?: string;
  /** 오전 9시를 0으로 한 시작·종료 시각. 0.5는 30분 단위다. */
  start?: number;
  end?: number;
  /** 표시용 담당자 이니셜. assignee가 있으면 assignee의 첫 글자를 쓴다. */
  owner?: string;
  /** 담당자 이름. 지정된 업무는 담당자만 완료할 수 있다. */
  assignee?: string;
  /** 만든 사람. 만든 사람만 수정·삭제·담당자 지정을 할 수 있다. */
  createdBy?: string;
  late?: boolean;
  /** 칸반 업무 상태. 기존 저장 데이터는 완료 여부에 따라 진행/완료로 해석한다. */
  workflowStatus?: '진행' | '검토 대기' | '완료' | '보류';
  /** 제작 파트. 없으면 공통 일정으로 모든 파트 화면에 나온다. */
  part?: ProductPart;
  children?: CheckItem[];
};

/** 현재 사용자와 담당자로 지정할 수 있는 행사 인력. 목록 컴포넌트가 권한 판정에 쓴다. */
export type ItemAccess = { me: string; members: string[] };

/** 만든 사람 기록이 없는 기존 항목은 제한 없이 수정할 수 있다. */
export function canEditItem(item: CheckItem, me: string): boolean {
  return !item.createdBy || item.createdBy === me;
}

/** 담당자가 있으면 담당자만, 없으면 만든 사람이 완료할 수 있다. 하위 항목이 함께 바뀌므로 모두 통과해야 한다. */
export function canToggleItem(item: CheckItem, me: string): boolean {
  const own = item.assignee ? item.assignee === me : canEditItem(item, me);
  return own && (item.children ?? []).every((c) => canToggleItem(c, me));
}

/** 이니셜만 있는 기존 데이터에 담당자 이름과 만든 사람(=담당자)을 채운다. */
export function resolveOwners(items: CheckItem[], members: string[]): CheckItem[] {
  return items.map((item) => {
    const assignee = item.assignee ?? (item.owner ? members.find((m) => m.startsWith(item.owner!)) : undefined);
    return {
      ...item,
      assignee,
      createdBy: item.createdBy ?? assignee,
      children: item.children ? resolveOwners(item.children, members) : undefined,
    };
  });
}

export type Progress = { done: number; total: number };

/** 하위 항목이 있으면 하위 항목의 합, 없으면 자기 자신 1건으로 센다. */
export function countLeaves(items: CheckItem[]): Progress {
  return items.reduce<Progress>(
    (acc, item) => {
      if (item.children?.length) {
        const c = countLeaves(item.children);
        return { done: acc.done + c.done, total: acc.total + c.total };
      }
      return { done: acc.done + (item.done ? 1 : 0), total: acc.total + 1 };
    },
    { done: 0, total: 0 },
  );
}

/** 하위 항목이 모두 완료되면 상위 항목도 완료로 맞춘다. */
function normalize(item: CheckItem): CheckItem {
  if (!item.children?.length) return item;
  const children = item.children.map(normalize);
  const done = children.every((c) => c.done);
  return { ...item, children, done, completedAt: done ? item.completedAt ?? Date.now() : undefined };
}

/** 저장 당시 상위 체크 상태가 어긋난 데이터도 하위 항목을 기준으로 바로잡는다. */
export function normalizeTree(items: CheckItem[]): CheckItem[] {
  return items.map(normalize);
}

function mapTree(items: CheckItem[], id: string, fn: (item: CheckItem) => CheckItem): CheckItem[] {
  return items.map((item) => (item.id === id ? fn(item) : item.children ? { ...item, children: mapTree(item.children, id, fn) } : item));
}

function setAll(item: CheckItem, done: boolean): CheckItem {
  return {
    ...item,
    done,
    workflowStatus: done ? '완료' : '진행',
    completedAt: done ? Date.now() : undefined,
    children: item.children?.map((c) => setAll(c, done)),
  };
}

function findItem(items: CheckItem[], id: string): CheckItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const found = item.children && findItem(item.children, id);
    if (found) return found;
  }
  return undefined;
}

/** 아래 변경 함수는 UI와 별개로 권한이 없으면 목록을 그대로 돌려준다. */
export function toggleItem(items: CheckItem[], id: string, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canToggleItem(target, me)) return items;
  return mapTree(items, id, (item) => setAll(item, !item.done)).map(normalize);
}

export function addChild(items: CheckItem[], parentId: string, title: string, createdBy: string): CheckItem[] {
  const parent = findItem(items, parentId);
  if (!parent || !canEditItem(parent, createdBy)) return items;
  const child: CheckItem = { id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, title, done: false, createdBy };
  return mapTree(items, parentId, (item) => ({ ...item, children: [...(item.children ?? []), child] })).map(normalize);
}

export function addRoot(items: CheckItem[], title: string, createdBy?: string, details: Pick<CheckItem, 'date' | 'start' | 'end' | 'assignee'> = {}): CheckItem[] {
  return [...items, {
    id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    title,
    done: false,
    createdBy,
    date: details.date || undefined,
    start: details.start,
    end: details.end,
    assignee: details.assignee || undefined,
    owner: details.assignee?.slice(0, 1),
  }];
}

export function assignItem(items: CheckItem[], id: string, assignee: string | undefined, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canEditItem(target, me)) return items;
  return mapTree(items, id, (item) => ({ ...item, assignee, owner: assignee?.slice(0, 1) }));
}

export function renameItem(items: CheckItem[], id: string, title: string, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canEditItem(target, me)) return items;
  return mapTree(items, id, (item) => ({ ...item, title }));
}

export function setWorkflowStatus(items: CheckItem[], id: string, status: NonNullable<CheckItem['workflowStatus']>, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canEditItem(target, me)) return items;
  return mapTree(items, id, (item) => ({
    ...item,
    workflowStatus: status,
    done: status === '완료',
    completedAt: status === '완료' ? item.completedAt ?? Date.now() : undefined,
  })).map(normalize);
}

function removeNode(items: CheckItem[], id: string): CheckItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => (item.children ? { ...item, children: removeNode(item.children, id) } : item))
    .map(normalize);
}

export function removeItem(items: CheckItem[], id: string, me: string): CheckItem[] {
  const target = findItem(items, id);
  if (!target || !canEditItem(target, me)) return items;
  return removeNode(items, id);
}
