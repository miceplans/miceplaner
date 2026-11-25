import type { StatusKey } from '@miceplans/ui';
import type { ProductPart } from './event-parts';

export type Team = 'planning' | 'design';

export type RequestStatus = 'pending' | 'reject' | 'success' | 'draft';

export type RequestRow = {
  id: string;
  name: string;
  part: ProductPart;
  due: string;
  size: string;
  qty: string;
  material: string;
  vendor: string;
  contact: string;
  note: string;
  negotiating: boolean;
  status: RequestStatus;
};

export const HEAD = 'bg-surface-cell';
export const LINE = 'border-border-strong';
export const CELL = 'flex h-[40px] shrink-0 items-center rounded-lg px-[8px] text-[15px] text-fg';

export type ProgressRow = {
  id: string;
  name: string;
  part: ProductPart;
  due: string; // 마감일 (MM.DD)
  doneAt: string | null; // 완료일. 미완료면 null
  size: string;
  qty: string;
  status: StatusKey;
  owner: string;
  material: string;
  vendor: string;
  contact: string;
  note: string;
};

/** 디자인 요청 상태를 진행상황 표의 상태로 옮긴다. */
const PROGRESS_STATUS: Record<RequestStatus, StatusKey> = {
  draft: '진행중',
  pending: '확인중',
  reject: '보류중',
  success: '성공',
};

const fmtMMDD = (d: string) => (d ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : '');

/** 디자인 요청 행을 진행상황 표 행으로 바꾼다. 완료일은 아직 별도 데이터가 없어 승인 완료된 요청의 마감일을 대신 쓴다. */
export function toProgressRow(r: RequestRow): ProgressRow {
  const due = fmtMMDD(r.due);
  return {
    id: r.id,
    name: r.name,
    part: r.part,
    due,
    doneAt: r.status === 'success' ? due || '완료' : null,
    size: r.size,
    qty: r.qty,
    status: PROGRESS_STATUS[r.status],
    owner: '',
    material: r.material,
    vendor: r.vendor,
    contact: r.contact,
    note: r.note,
  };
}

/** 디자인팀이 본 의견을 행별로 기억하는 로컬 저장 키. 서버 의견 API가 생기면 대체한다. */
export const progressCommentKey = (eventId: string) => `miceplans.progress-comments.${eventId}`;

export type ProgressSort = '완료일순' | '마감일순' | '상태순';

export const SORT_OPTIONS: { value: ProgressSort; label: string }[] = [
  { value: '완료일순', label: '완료일 빠른 순' },
  { value: '마감일순', label: '마감일 빠른 순' },
  { value: '상태순', label: '상태 순' },
];

const STATUS_ORDER: Record<StatusKey, number> = { 진행중: 0, 제출: 1, 확인중: 2, 보류중: 3, 반려: 4, 실패: 5, 만료: 6, 종료: 7, 성공: 8 };

/** 기본 정렬은 완료일(없으면 마감일) 빠른 순, 날짜가 없는 행은 뒤로 내는다. */
export function sortProgress(rows: ProgressRow[], sort: ProgressSort): ProgressRow[] {
  const key = (r: ProgressRow) => (sort === '완료일순' ? r.doneAt ?? r.due : r.due);
  return [...rows].sort((a, b) => {
    if (sort === '상태순') return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    const ka = key(a);
    const kb = key(b);
    if (!ka && !kb) return 0;
    if (!ka) return 1;
    if (!kb) return -1;
    return ka.localeCompare(kb);
  });
}

/** 요청을 보내기 전에 채워야 하는 항목. 표 머리글의 * 표시와 같다. */
const REQUIRED: { key: 'name' | 'size' | 'material'; label: string }[] = [
  { key: 'name', label: '품명' },
  { key: 'size', label: '사이즈' },
  { key: 'material', label: '재질' },
];
export const missingFields = (r: RequestRow): string[] => REQUIRED.filter((f) => !r[f.key].trim()).map((f) => f.label);

/** 작성 중이거나 반려된 요청만 승인 대기로 보낼 수 있다. */
export const canRequest = (r: RequestRow): boolean => r.status === 'draft' || r.status === 'reject';

export const FIELDS = ['name', 'size', 'qty', 'material', 'vendor', 'contact', 'note'] as const;
export const WIDTHS = ['w-[120px]', 'w-[100px]', 'w-[85px]', 'w-[85px]', 'w-[140px]', 'w-[180px]', 'w-[120px]'];

const STATUS_LABEL: Record<RequestStatus, string> = { pending: '승인 대기', reject: '반려', success: '승인 완료', draft: '작성 중' };

/** 디자인 요청 목록을 CSV로 다운로드한다. 표에 보이는 컬럼 그대로 담는다. */
export function downloadDesignRequests(eventName: string, rows: RequestRow[]) {
  const header = ['품명', '파트', '마감일', '사이즈', '수량', '재질', '발주업체', '업체 담당자(연락처)', '비고', '협의중', '상태'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.map(esc).join(','),
    ...rows.map((r) =>
      [r.name, r.part, r.due, r.size, r.qty, r.material, r.vendor, r.contact, r.note, r.negotiating ? '예' : '아니오', STATUS_LABEL[r.status]].map(esc).join(','),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `design-requests-${eventName.replace(/[\\/:*?"<>|\s]+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
