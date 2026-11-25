import { z } from 'zod';
import { isoDate, isoDateTime, uuid } from './common';

/** Client 포털 전용 계약. 내부 도메인 계약을 import하지 않는다 (명세 F-07). */
export const portalEventDto = z.object({ eventId: uuid, name: z.string(), startDate: isoDate, endDate: isoDate, place: z.string() });
export const portalProgramDto = z.object({ eventId: uuid, programId: uuid, title: z.string(), startsOn: isoDate.nullable(), dueOn: isoDate.nullable() });
export type PortalEventDto = z.infer<typeof portalEventDto>;
export type PortalProgramDto = z.infer<typeof portalProgramDto>;

/** 비로그인 공개 캘린더. 공개 표시한 행사의 행사명과 기간만 담는다 (장소·고객사·Program 제외, 2026-11-24 결정). */
export const publicEventDto = z.object({ eventId: uuid, name: z.string(), startDate: isoDate, endDate: isoDate, color: z.string().nullable() });
export type PublicEventDto = z.infer<typeof publicEventDto>;

/**
 * Client 알림함 (2026-11-25 결정). 공개 Program의 공개와 일정 변경만 담는다.
 * 변경한 사람·담당자·내부 멤버 정보는 계약에 두지 않는다.
 */
export const portalNotificationKind = z.enum(['program_published', 'schedule_changed']);
export const portalNotificationDto = z.object({
  id: z.number().int().positive(),
  kind: portalNotificationKind,
  eventId: uuid,
  eventName: z.string(),
  programId: uuid,
  programTitle: z.string(),
  beforeStartsOn: isoDate.nullable(),
  beforeDueOn: isoDate.nullable(),
  afterStartsOn: isoDate.nullable(),
  afterDueOn: isoDate.nullable(),
  createdAt: isoDateTime,
  readAt: isoDateTime.nullable(),
});
export const markPortalNotificationsReadBody = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }).strict();
export type PortalNotificationDto = z.infer<typeof portalNotificationDto>;
export type MarkPortalNotificationsReadBody = z.infer<typeof markPortalNotificationsReadBody>;
