import { describe, expect, it } from 'vitest';
import type { ImportTargetField } from '@miceplans/contracts';
import { buildWikiBody, normalizeImportRow, parseDateText, validateImportRows } from './validate';

const MAPPING: Record<string, ImportTargetField> = { 0: 'name', 1: 'startDate', 2: 'endDate', 3: 'client', 4: 'pm', 5: 'status', 6: 'place' };

describe('parseDateText', () => {
  it('허용하는 날짜 형태를 YYYY-MM-DD로 바꾼다', () => {
    expect(parseDateText('2025-03-06')).toBe('2025-03-06');
    expect(parseDateText('2025.3.6')).toBe('2025-03-06');
    expect(parseDateText('2025/03/06')).toBe('2025-03-06');
    expect(parseDateText('20250306')).toBe('2025-03-06');
    // 엑셀 날짜 시리얼: 44927 = 2023-01-01, 45292 = 2024-01-01
    expect(parseDateText('44927')).toBe('2023-01-01');
    expect(parseDateText('45292')).toBe('2024-01-01');
  });
  it('빈 값과 날짜가 아닌 값은 null이다', () => {
    expect(parseDateText('')).toBeNull();
    expect(parseDateText('  ')).toBeNull();
    expect(parseDateText('3월 6일')).toBeNull();
    expect(parseDateText('2025-13-01')).toBeNull();
    expect(parseDateText('2025-02-30')).toBeNull();
    expect(parseDateText('1234')).toBeNull(); // 시리얼 범위 밖
  });
});

describe('normalizeImportRow', () => {
  it('모든 필수 값이 있으면 통과하고 경고가 없다', () => {
    const row = normalizeImportRow(['행사', '2025-03-06', '2025-03-08', '고객사', '홍길동', '성공', '코엑스'], 2, MAPPING);
    expect(row).toMatchObject({ row: 2, ok: true, name: '행사', startDate: '2025-03-06', endDate: '2025-03-08', status: '성공', failures: [], warnings: [] });
  });
  it('행사명·시작일·고객사가 비면 실패 사유를 남긴다', () => {
    const row = normalizeImportRow(['', '', '2025-03-08', '', '', '진행중', ''], 5, MAPPING);
    expect(row.ok).toBe(false);
    expect(row.failures.join(' ')).toContain('행사명이 비어 있음');
    expect(row.failures.join(' ')).toContain('시작일이 비어 있음');
    expect(row.failures.join(' ')).toContain('고객사가 비어 있음');
  });
  it('종료일이 시작일보다 빠른 경우 실패다', () => {
    const row = normalizeImportRow(['행사', '2025-03-08', '2025-03-01', '고객사', '', '진행중', ''], 3, MAPPING);
    expect(row.ok).toBe(false);
    expect(row.failures.join(' ')).toContain('종료일이 시작일보다 빠름');
  });
  it('알 수 없는 상태와 빈 장소는 경고로 처리하고 상태는 진행중이 된다', () => {
    const row = normalizeImportRow(['행사', '2025-03-06', '', '고객사', '', '보류중2', ''], 4, MAPPING);
    expect(row.ok).toBe(true);
    expect(row.status).toBe('진행중');
    expect(row.warnings.join(' ')).toContain(`'보류중2'`);
    expect(row.warnings.join(' ')).toContain('장소 값이 비어 있음');
  });
  it('종료일 컬럼을 매핑하지 않으면 종료일은 시작일과 같다', () => {
    const mapping: Record<string, ImportTargetField> = { 0: 'name', 1: 'startDate' };
    const row = normalizeImportRow(['행사', '2025-03-06'], 2, mapping);
    expect(row.ok).toBe(true);
    expect(row.endDate).toBe('2025-03-06');
  });
});

describe('validateImportRows', () => {
  it('전체 행을 검증하고 표시 상한을 넘기면 truncated다', () => {
    const rows = Array.from({ length: 60 }, (_, i) => [`행사${i}`, '2025-03-06', '', '고객사', '', '진행중', '']);
    const v = validateImportRows([], rows, rows.map((_, i) => i + 2), MAPPING);
    expect(v.total).toBe(60);
    expect(v.valid).toBe(60);
    expect(v.rows).toHaveLength(50);
    expect(v.truncated).toBe(true);
    expect(v.rows[0]!.row).toBe(2); // 원본 시트 행 번호 유지
  });
});

describe('buildWikiBody', () => {
  it('매핑된 속성과 나머지 컬럼을 마크다운 표로 담는다', () => {
    const mapped = normalizeImportRow(['행사', '2025-03-06', '2025-03-08', '고객사', '홍길동', '진행중', '코엑스', '기타 내용'], 2, MAPPING);
    const body = buildWikiBody(mapped, [{ index: 0, label: '행사명' }, { index: 7, label: '비고' }], ['행사', '2025-03-06', '2025-03-08', '고객사', '홍길동', '진행중', '코엑스', '기타 내용'], MAPPING);
    expect(body).toContain('| 행사명 | 행사 |');
    expect(body).toContain('| 기간 · 시작 | 2025-03-06 |');
    expect(body).toContain('| 비고 | 기타 내용 |');
  });
});
