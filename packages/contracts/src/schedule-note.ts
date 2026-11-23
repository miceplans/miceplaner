import { z } from 'zod';
import { isoDateTime, uuid } from './common';

/** 캘린더 일정 상세 패널 내용 (명세 F-04). 담당자는 인력 이름이고, 빈 문자열은 미지정이다. */
const personName = z.string().trim().max(50);
const shortId = z.string().min(1).max(64);
const title = z.string().max(200);

export const scheduleNoteSubtask = z.object({ id: shortId, title, who: personName, done: z.boolean() });
export const scheduleNoteTask = z.object({ id: shortId, title, who: personName, subs: z.array(scheduleNoteSubtask).max(100) });
export const scheduleNoteLink = z.object({
  id: shortId,
  name: z.string().trim().min(1).max(200),
  url: z.url({ protocol: /^https?$/ }).max(2000),
});

export const scheduleNoteContent = z.object({
  assignees: z.array(personName.min(1)).max(50),
  description: z.string().max(5000),
  clientMemo: z.string().max(5000),
  tasks: z.array(scheduleNoteTask).max(100),
  links: z.array(scheduleNoteLink).max(100),
});
export type ScheduleNoteContent = z.infer<typeof scheduleNoteContent>;

export const EMPTY_SCHEDULE_NOTE: ScheduleNoteContent = { assignees: [], description: '', clientMemo: '', tasks: [], links: [] };

/** 메인 캘린더 날짜(day:YYYY-MM-DD…)나 행사 일정(event:…) 단위의 키. */
export const scheduleNoteKey = z.string().trim().min(1).max(200);

export const getScheduleNoteQuery = z.object({ key: scheduleNoteKey });
export type GetScheduleNoteQuery = z.infer<typeof getScheduleNoteQuery>;

/**
 * 바뀐 필드만 보낸다. 텍스트·할 일·링크는 마지막 저장 우선이고,
 * 담당자(assignees)를 바꿀 때만 baseVersion이 현재 version과 같아야 한다 (명세 3.2). 아직 없는 메모는 0이다.
 */
export const saveScheduleNoteBody = z.object({
  key: scheduleNoteKey,
  eventId: uuid.nullable().optional(),
  baseVersion: z.number().int().min(0),
  patch: scheduleNoteContent.partial().refine((p) => Object.keys(p).length > 0, '바꿀 항목이 없습니다.'),
});
export type SaveScheduleNoteBody = z.infer<typeof saveScheduleNoteBody>;

export const scheduleNoteDto = z.object({
  key: z.string(),
  eventId: uuid.nullable(),
  content: scheduleNoteContent,
  /** 저장된 적이 없으면 0이다. */
  version: z.number().int().min(0),
  updatedAt: isoDateTime.nullable(),
});
export type ScheduleNoteDto = z.infer<typeof scheduleNoteDto>;
