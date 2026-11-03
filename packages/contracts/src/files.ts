import { z } from 'zod';
import { ROLES } from '@miceplans/domain';
import { isoDateTime, uuid } from './common';

/** 업로드 파일 하나의 크기 상한(바이트). API는 이 값을 넘는 요청을 413으로 거부한다. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const fileStatus = z.enum(['pending', 'ready', 'failed']);

/** 업로드 파일 메타데이터. 변환이 끝나면 docId가 생기고 그 문서가 검색·출처의 단위가 된다 (명세 F-10). */
export const fileDto = z.object({
  id: uuid,
  eventId: uuid,
  docId: uuid.nullable(),
  name: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: fileStatus,
  error: z.string().nullable(),
  uploadedBy: uuid,
  createdAt: isoDateTime,
});
export type FileDto = z.infer<typeof fileDto>;

// ── 작업 큐(pg-boss) 입력 ─────────────────────────────────────────────────
// 작업 입력에는 처리 대상과 함께 워크스페이스·실행 주체를 담아 worker가 같은 RLS 원칙으로 실행하게 한다 (ADR 0001).

export const jobContext = z.object({ workspaceId: z.string().min(1), userId: uuid, role: z.enum(ROLES) });
export type JobContext = z.infer<typeof jobContext>;

export const JOB_PARSE_FILE = 'parse-file';
export const JOB_EMBED_DOC = 'embed-doc';

export const parseFileJob = z.object({ fileId: uuid, ctx: jobContext });
export type ParseFileJob = z.infer<typeof parseFileJob>;

export const embedDocJob = z.object({ docId: uuid, ctx: jobContext });
export type EmbedDocJob = z.infer<typeof embedDocJob>;
