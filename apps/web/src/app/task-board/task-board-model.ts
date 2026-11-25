/** 칸반 열. 상태값 자체가 열 ID가 된다. */
export const ITEM_STATUSES = ['할 일', '진행 중', '검토 대기', '보류', '취소', '완료'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const DOT_OF: Record<ItemStatus, string> = {
  '할 일': 'dot-todo',
  '진행 중': 'dot-progress',
  '검토 대기': 'dot-review',
  '보류': 'dot-hold',
  '취소': 'dot-cancel',
  '완료': 'dot-done',
};

/** 담당자 배지 톤. 고정 명단 대신 이름 문자 합으로 정해 같은 사람은 같은 색을 쓰게 한다. */
const AVATAR_TONES = [
  'bg-notice-bg text-notice',
  'bg-success-bg text-success-deep',
  'bg-info-bg text-brand-blue',
  'bg-surface-chip text-fg-secondary',
  'bg-submit-bg text-brand-soft',
];
export function avatarTone(name: string): string {
  let h = 0;
  for (const ch of name) h = (h + ch.charCodeAt(0)) % 997;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

/** 저장 형식은 yyyy-mm-dd. 화면에는 MM.DD로 표시. */
export const fmtDue = (due: string | null) => (due ? `${due.slice(5, 7)}.${due.slice(8, 10)}` : '-');

// 지연 판정 기준일(로컬 시간대 YYYY-MM-DD).
export const TODAY = new Date().toLocaleDateString('sv-SE');

export type Task = {
  id: string;
  eventId: string;
  event: string;
  schedule: string;
  title: string;
  due: string | null;
  late?: boolean;
  who: string;
  assigneeId: string | null;
  createdBy: string;
  createdById: string;
  status: ItemStatus;
  version: number;
};
export type Column = { id: ItemStatus; name: string; dot: string; done?: boolean; cancelled?: boolean; tasks: Task[] };

export type EventOption = { id: string; name: string; startDate: string; mine: boolean };

export const ALL = '전체 행사';

export type SortMode = 'default' | 'due-asc' | 'due-desc';

/** 선택한 행사 필터와 정렬을 저장해 새로고침 후에도 유지한다. */
const PREFS_KEY = 'miceplans.task-board.prefs';
type Prefs = { event?: string; sortMode?: SortMode };

export function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      const prefs = parsed as Prefs;
      return {
        event: typeof prefs.event === 'string' ? prefs.event : undefined,
        sortMode: prefs.sortMode === 'due-asc' || prefs.sortMode === 'due-desc' ? prefs.sortMode : undefined,
      };
    }
  } catch {
    /* 저장값이 깨져 있으면 기본값으로 돌아간다. */
  }
  return {};
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* 저장할 수 없는 환경에서는 현재 화면에만 적용한다. */
  }
}

export type TaskFormValues = { title: string; event: string; schedule: string; due: string | null; who: string; status: string };

export type DialogState = { mode: 'add'; status: string } | { mode: 'edit'; taskId: string };
