import { EVENT_STATUSES, type EventStatus } from '@miceplans/domain';
import type { ImportTargetField } from '@miceplans/contracts';

export const IMPORT_FIELD_LABELS: Record<ImportTargetField, string> = {
  name: '행사명',
  startDate: '기간 · 시작',
  endDate: '기간 · 끝',
  client: '고객사',
  pm: 'PM',
  status: '상태',
  place: '장소',
};

/** 검증 결과 표시 상한. 넘는 행은 개수만 남긴다. */
export const PREVIEW_ROW_LIMIT = 50;
export const ISSUE_LIST_LIMIT = 200;

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 엑셀 날짜 시리얼(1900-01-01=1 체계의 1899-12-30 기준)을 날짜로 바꾼다. */
function excelSerialToDate(serial: number): string | null {
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * 셀 문자열을 YYYY-MM-DD로 바꾼다. 허용 형태: YYYY-MM-DD·YYYY.MM.DD·YYYY/MM/DD(월일 한 자리 포함),
 * YYYYMMDD, YY.MM.DD, `2025년 3월 6일`, 끝에 붙은 요일·시간(`2025-03-06(목)`, `2025-03-06 09:00`, ISO 시각),
 * 엑셀 날짜 시리얼. 실제 날짜가 아니면 null이다.
 */
export function parseDateText(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // 요일 `(목)`·`[목]`·`목요일`, 시간 `09:00`·`T09:00:00Z`를 떼고 날짜만 본다.
  s = s
    .replace(/[([](?:월|화|수|목|금|토|일)[)\]]/g, '')
    .replace(/(?:월|화|수|목|금|토|일)요일/g, '')
    .replace(/[T\s]+\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?\s*(?:AM|PM|오전|오후)?$/i, '')
    .trim();
  const ko = s.match(/^(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (ko) return validDate(fullYear(ko[1]!), Number(ko[2]), Number(ko[3]));
  const m = s.match(/^(\d{2,4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\.?$/);
  if (m) return validDate(fullYear(m[1]!), Number(m[2]), Number(m[3]));
  if (/^\d{8}$/.test(s)) return validDate(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 20_000 && serial <= 80_000) return excelSerialToDate(serial);
  }
  return null;
}

/** 두 자리 연도는 2000년대로 본다. 세 자리는 날짜로 보지 않는다. */
function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : y.length === 4 ? Number(y) : Number.NaN;
}

export type MappedRow = {
  /** 원본 시트 행 번호 (1부터). */
  row: number;
  name: string;
  startDate: string;
  endDate: string;
  client: string;
  pm: string;
  status: EventStatus;
  place: string;
  ok: boolean;
  /** 실패 사유 (ok=false일 때만 채워진다). */
  failures: string[];
  /** 반영은 하지만 사용자에게 알릴 경고. */
  warnings: string[];
};

/** 매핑에서 필드가 들어 있는 컬럼 인덱스를 찾는다. 하나만 매핑돼야 한다(서비스가 중복을 막는다). */
const columnOf = (mapping: Record<string, ImportTargetField>, field: ImportTargetField): number | undefined => {
  for (const [key, f] of Object.entries(mapping)) if (f === field) return Number(key);
  return undefined;
};

/**
 * 그리드 한 행을 매핑에 따라 행사 속성으로 바꾸고 필수 값과 형식을 검증한다.
 * 실패 사유는 사용자에게 그대로 보이므로 짧게 적는다.
 */
export type FixedValues = Partial<Record<ImportTargetField, string>>;

export function normalizeImportRow(values: string[], rowNumber: number, mapping: Record<string, ImportTargetField>, fixed: FixedValues = {}): MappedRow {
  // 매핑한 컬럼 값이 있으면 그 값을, 비었거나 매핑이 없으면 직접 입력한 고정값을 쓴다.
  const cell = (field: ImportTargetField): string => {
    const i = columnOf(mapping, field);
    const fromSheet = i === undefined ? '' : (values[i] ?? '').trim();
    return fromSheet || (fixed[field] ?? '').trim();
  };
  const failures: string[] = [];
  const warnings: string[] = [];

  const name = cell('name');
  if (!name) failures.push('행사명이 비어 있음');

  const startRaw = cell('startDate');
  const start = parseDateText(startRaw);
  if (!start) failures.push(startRaw ? `시작일 '${startRaw}'을(를) 인식할 수 없음` : '시작일이 비어 있음');

  const endIndex = columnOf(mapping, 'endDate');
  const endRaw = cell('endDate');
  const end = endRaw ? parseDateText(endRaw) : start;
  if (endIndex !== undefined && !endRaw) warnings.push('종료일이 비어 있어 시작일과 같게 처리');
  if (endRaw && !end) failures.push(`종료일 '${endRaw}'을(를) 인식할 수 없음`);
  if (start && end && end < start) failures.push('종료일이 시작일보다 빠름');

  const client = cell('client');
  if (!client) failures.push('고객사가 비어 있음');

  const statusRaw = cell('status');
  let status: EventStatus = '진행중';
  if (statusRaw) {
    const found = (EVENT_STATUSES as readonly string[]).find((s) => s === statusRaw);
    if (found) status = found as EventStatus;
    else warnings.push(`상태 값 '${statusRaw}'을(를) 인식할 수 없어 '진행중'으로 처리`);
  }

  const pm = cell('pm');
  const place = cell('place');
  if (!place) warnings.push('장소 값이 비어 있음');

  return {
    row: rowNumber,
    name,
    startDate: start ?? '',
    endDate: end ?? '',
    client,
    pm,
    status,
    place,
    ok: failures.length === 0,
    failures,
    warnings,
  };
}

/** 전체 그리드를 검증해 미리보기 DTO를 만든다. */
export function validateImportRows(
  columns: { index: number; label: string }[],
  rows: string[][],
  rowNumbers: number[],
  mapping: Record<string, ImportTargetField>,
  fixed: FixedValues = {},
): { total: number; valid: number; invalid: number; rows: (MappedRow & { issues: string[] })[]; truncated: boolean } {
  const mapped = rows.map((values, i) => normalizeImportRow(values, rowNumbers[i] ?? i + 1, mapping, fixed));
  const preview = mapped.map((r) => ({ ...r, issues: [...r.failures, ...r.warnings] }));
  return {
    total: preview.length,
    valid: preview.filter((r) => r.ok).length,
    invalid: preview.filter((r) => !r.ok).length,
    rows: preview.slice(0, PREVIEW_ROW_LIMIT),
    truncated: preview.length > PREVIEW_ROW_LIMIT,
  };
}

/**
 * 가져온 행사의 위키 본문이다. 매핑된 속성 표와 매핑되지 않은 나머지 컬럼을 함께 담아
 * 원본 행 내용이 위키에서도 남는다.
 */
export function buildWikiBody(
  mapped: MappedRow,
  columns: { index: number; label: string }[],
  values: string[],
  mapping: Record<string, ImportTargetField>,
): string {
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
  const mappedIndexes = new Set(Object.keys(mapping).map(Number));
  const lines: string[] = ['| 항목 | 내용 |', '| --- | --- |'];
  for (const field of ['name', 'startDate', 'endDate', 'client', 'pm', 'status', 'place'] as const) {
    const label = IMPORT_FIELD_LABELS[field];
    const value = field === 'startDate' || field === 'endDate' ? mapped[field] : mapped[field] || '—';
    lines.push(`| ${label} | ${esc(value)} |`);
  }
  const extra = columns.filter((c) => !mappedIndexes.has(c.index) && (values[c.index] ?? '').trim() !== '');
  if (extra.length > 0) {
    lines.push('', `| 원본 컬럼 | 값 |`, '| --- | --- |');
    for (const c of extra) lines.push(`| ${esc(c.label)} | ${esc(values[c.index] ?? '')} |`);
  }
  return lines.join('\n').slice(0, 20_000);
}
