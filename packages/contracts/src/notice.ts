import { z } from 'zod';
import { isoDateTime, uuid } from './common';

/** 공지 (명세 F-13). eventId가 없으면 전체 공지고, 있으면 그 행사 멤버에게만 보인다. */
export const noticeDto = z.object({
  id: uuid,
  eventId: uuid.nullable(),
  eventName: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  authorId: uuid,
  authorName: z.string(),
  createdAt: isoDateTime,
  /** 내가 닫은 시각. null이면 목록 최상단에 고정된 상태다. */
  dismissedAt: isoDateTime.nullable(),
});
export type NoticeDto = z.infer<typeof noticeDto>;

/** 공지 작성. eventId를 비우면 전체 공지다. 전체 공지는 Super Admin만 올릴 수 있다 (명세 F-13). */
export const createNoticeBody = z.object({
  eventId: uuid.nullable().optional(),
  title: z.string().trim().min(1, '제목을 입력하세요').max(200),
  body: z.string().trim().min(1, '내용을 입력하세요').max(5000),
});
export type CreateNoticeBody = z.infer<typeof createNoticeBody>;
