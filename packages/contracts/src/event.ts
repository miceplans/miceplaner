import { z } from 'zod';
import { EVENT_STATUSES } from '@miceplans/domain';
import { expectedVersion, isoDate, isoDateTime, uuid } from './common';

export const eventStatus = z.enum(EVENT_STATUSES);

export const eventDto = z.object({
  id: uuid,
  clientId: uuid,
  name: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  place: z.string(),
  status: eventStatus,
  priority: z.boolean(),
  color: z.string().nullable(),
  budget: z.number().int().nonnegative().nullable(),
  /** 비로그인 공개 캘린더 노출 여부. 기본값은 비공개다 (명세 F-07). */
  publicVisible: z.boolean(),
  version: z.number().int().positive(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type EventDto = z.infer<typeof eventDto>;

/** 목록·상세 화면은 고객사 이름과 PM·AM·디자인 담당 이름을 함께 보여 준다 (표 렌더링용 조인 결과). 여러 명이면 쉼표로 잇는다. */
export const eventListItemDto = eventDto.extend({
  clientName: z.string().nullable(),
  pmName: z.string().nullable(),
  amName: z.string().nullable(),
  designName: z.string().nullable(),
});
export type EventListItemDto = z.infer<typeof eventListItemDto>;

const dateRange = (v: { startDate?: string; endDate?: string }) => !v.startDate || !v.endDate || v.endDate >= v.startDate;

/** 예산(원). 비우면 미정이다. */
const budget = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** 내부 직원이 생성하고, 생성자는 해당 행사의 PM이 된다 (명세 F-02, 2026-11-17 결정). */
export const createEventBody = z
  .object({
    clientId: uuid,
    budget: budget.nullable().default(null),
    name: z.string().trim().min(1).max(200),
    startDate: isoDate,
    endDate: isoDate,
    place: z.string().max(200).default(''),
    status: eventStatus.default('진행중'),
    priority: z.boolean().default(false),
    color: z.string().max(32).nullable().default(null),
  })
  .refine(dateRange, { message: '종료일은 시작일 이후여야 한다', path: ['endDate'] });
export type CreateEventBody = z.infer<typeof createEventBody>;

/** 일반 필드는 마지막 저장 우선이라 version을 받지 않는다. */
export const updateEventBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    startDate: isoDate,
    endDate: isoDate,
    place: z.string().max(200),
    status: eventStatus,
    priority: z.boolean(),
    color: z.string().max(32).nullable(),
    budget: budget.nullable(),
  })
  .partial()
  .refine(dateRange, { message: '종료일은 시작일 이후여야 한다', path: ['endDate'] });
export type UpdateEventBody = z.infer<typeof updateEventBody>;

/** 공개 상태는 버전 검사 대상이다. 화면이 본 version과 다르면 409로 막는다 (명세 3.2). */
export const setEventPublicVisibilityBody = z.object({ publicVisible: z.boolean(), version: z.number().int().positive() });
export type SetEventPublicVisibilityBody = z.infer<typeof setEventPublicVisibilityBody>;

export const listEventsQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  clientId: uuid.optional(),
  status: eventStatus.optional(),
});
export type ListEventsQuery = z.infer<typeof listEventsQuery>;

/** design(디자인 담당)은 권한상 member와 같고, 행사 상세의 '디자인' 속성 표시에만 구분한다. */
export const eventMemberRole = z.enum(['pm', 'am', 'design', 'member']);
export type EventMemberRole = z.infer<typeof eventMemberRole>;
export const eventMemberDto = z.object({ eventId: uuid, userId: uuid, role: eventMemberRole });
export type EventMemberDto = z.infer<typeof eventMemberDto>;

export const addEventMemberBody = z.object({ userId: uuid, role: eventMemberRole.default('member') });
export type AddEventMemberBody = z.infer<typeof addEventMemberBody>;
export const changeEventMemberRoleBody = z.object({ role: eventMemberRole });
export type ChangeEventMemberRoleBody = z.infer<typeof changeEventMemberRoleBody>;

/** 현재 PM이 행사 멤버에게 PM 역할을 넘길 때의 대상이다. */
export const transferPmBody = z.object({ userId: uuid });
export type TransferPmBody = z.infer<typeof transferPmBody>;
export { expectedVersion };
