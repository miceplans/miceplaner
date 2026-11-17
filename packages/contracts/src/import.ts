import { z } from 'zod';
import { isoDateTime, uuid } from './common';

/** 한 번에 가져올 수 있는 데이터 행 상한. 넘으면 413으로 거부한다. */
export const MAX_IMPORT_ROWS = 10_000;

/** 업로드 한 번의 파일 크기 상한은 파일 업로드와 같다 (files.ts MAX_FILE_BYTES). */
export const IMPORT_FILE_EXTENSIONS = ['xlsx', 'csv'] as const;

/** 가져오기 작업 상태. 업로드 → 시트 파싱 → 매핑·검증 → 실행 순으로 진행한다 (명세 F-08). */
export const importJobStatus = z.enum(['uploaded', 'parsed', 'previewed', 'executing', 'done', 'failed']);
export type ImportJobStatus = z.infer<typeof importJobStatus>;

/** 가져온 값이 채워지는 행사 속성. 화면의 시스템 속성과 같다. */
export const importTargetFields = ['name', 'startDate', 'endDate', 'client', 'pm', 'status', 'place'] as const;
export const importTargetField = z.enum(importTargetFields);
export type ImportTargetField = z.infer<typeof importTargetField>;

export const importSheetDto = z.object({
  name: z.string(),
  rowCount: z.number().int().nonnegative(),
});
export type ImportSheetDto = z.infer<typeof importSheetDto>;

export const importColumnDto = z.object({
  index: z.number().int().nonnegative(),
  label: z.string(),
});
export type ImportColumnDto = z.infer<typeof importColumnDto>;

/** 검증을 통과한 표시용 행. 원본 시트 행 번호(1부터)와 매핑된 값, 실패·경고 사유를 담는다. */
export const importPreviewRowDto = z.object({
  row: z.number().int().positive(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  client: z.string(),
  pm: z.string(),
  status: z.string(),
  place: z.string(),
  ok: z.boolean(),
  issues: z.array(z.string()),
});
export type ImportPreviewRowDto = z.infer<typeof importPreviewRowDto>;

export const importValidationDto = z.object({
  total: z.number().int().nonnegative(),
  valid: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
  /** 표시 상한까지만 담고 truncated가 true면 나머지가 있다는 뜻이다. */
  rows: z.array(importPreviewRowDto),
  truncated: z.boolean(),
});
export type ImportValidationDto = z.infer<typeof importValidationDto>;

export const importRowIssueDto = z.object({
  /** 원본 시트 행 번호 (1부터). */
  row: z.number().int().positive(),
  message: z.string(),
});
export type ImportRowIssueDto = z.infer<typeof importRowIssueDto>;

export const importResultDto = z.object({
  created: z.number().int().nonnegative(),
  failed: z.array(importRowIssueDto),
  warnings: z.array(importRowIssueDto),
  /** 목록은 상한까지만 담고 잘렸으면 true다. */
  failedTruncated: z.boolean(),
  warningsTruncated: z.boolean(),
  finishedAt: isoDateTime,
});
export type ImportResultDto = z.infer<typeof importResultDto>;

/** 매핑의 키는 컬럼 인덱스의 문자열 형태다. 매핑하지 않은 컬럼은 위키 본문에 함께 담긴다. */
export type ImportMapping = Record<string, (typeof importTargetFields)[number]>;

export const importJobDto = z.object({
  id: uuid,
  fileName: z.string(),
  status: importJobStatus,
  sheets: z.array(importSheetDto),
  sheet: z.string().nullable(),
  hasHeader: z.boolean().nullable(),
  headerRow: z.number().int().positive().nullable(),
  columns: z.array(importColumnDto).nullable(),
  dataRowCount: z.number().int().nonnegative().nullable(),
  mapping: z.record(z.string(), importTargetField).nullable(),
  validation: importValidationDto.nullable(),
  result: importResultDto.nullable(),
  error: z.string().nullable(),
  createdAt: isoDateTime,
});
export type ImportJobDto = z.infer<typeof importJobDto>;

/** 시트 선택과 헤더 지정. headerRow는 1부터 센다. */
export const parseImportBody = z.object({
  sheet: z.string().trim().min(1),
  hasHeader: z.boolean().default(true),
  headerRow: z.number().int().min(1).max(100).default(1),
});
export type ParseImportBody = z.infer<typeof parseImportBody>;

/** 컬럼 매핑으로 전체 행을 검증하고 미리보기를 만든다. */
export const previewImportBody = z.object({
  mapping: z.record(z.string(), importTargetField),
  /** 엑셀에 없는 값(PM 등)을 모든 행에 같은 값으로 쓴다. 매핑한 컬럼이 비어 있는 행에도 대신 쓴다. */
  fixed: z.record(importTargetField, z.string().trim().max(200)).optional(),
});
export type PreviewImportBody = z.infer<typeof previewImportBody>;
