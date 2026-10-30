import { z } from 'zod';
import { isoDateTime, uuid } from './common';
import { docVisibility } from './doc';

/** 위키 문서 본문 (Markdown 파생본). Yjs 원본은 협업 서버 단계에서 추가한다. */
export const docPageDto = z.object({
  id: uuid,
  eventId: uuid,
  title: z.string(),
  visibility: docVisibility,
  version: z.number().int().positive(),
  bodyMd: z.string(),
  updatedAt: isoDateTime,
});
export type DocPageDto = z.infer<typeof docPageDto>;

const MAX_BODY = 200_000;

export const createDocBody = z.object({
  title: z.string().trim().min(1).max(200),
  visibility: docVisibility.default('members'),
  bodyMd: z.string().max(MAX_BODY).default(''),
});
export type CreateDocBody = z.infer<typeof createDocBody>;

/** 제목·본문은 마지막 저장 우선이라 version을 받지 않는다 (명세 3.2). */
export const saveDocBodyBody = z.object({ title: z.string().trim().min(1).max(200).optional(), bodyMd: z.string().max(MAX_BODY) });
export type SaveDocBodyBody = z.infer<typeof saveDocBodyBody>;

export const searchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  eventId: uuid.optional(),
  clientId: uuid.optional(),
  /** 이 시각 이후에 수정된 문서만 (최신성 필터). */
  since: isoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});
export type SearchQuery = z.infer<typeof searchQuery>;

/** 검색 결과이자 AI 답변의 출처다. 권한 밖 문서는 이 목록에 나오지 않는다. */
export const searchHitDto = z.object({
  chunkId: uuid,
  docId: uuid,
  eventId: uuid,
  title: z.string(),
  heading: z.string(),
  snippet: z.string(),
  score: z.number(),
  updatedAt: isoDateTime,
});
export type SearchHitDto = z.infer<typeof searchHitDto>;
