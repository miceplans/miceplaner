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
  version: z.number().int().positive(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type EventDto = z.infer<typeof eventDto>;

const dateRange = (v: { startDate?: string; endDate?: string }) => !v.startDate || !v.endDate || v.endDate >= v.startDate;

/** 예산(원). 비우면 미정이다. */
const budget = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** 내부 직원이 행사 생성 화면에서 만든다. 생성 권한 확정(명세 6절) 전까지 가져오기와 같은 범위(내부 직원)로 연다. */
export const createEventBody = z
  .object({
    clientId: uuid,
    pmId: uuid,
    amId: uuid.nullable().default(null),
    budget: budget.nullable().default(null),
    name: z.string().trim().min(1).max(200),
    startDate: isoDate,
    endDate: isoDate,
    place: z.string().max(200).default(''),
    status: eventStatus.default('진행중'),
    priority: z.boolean().default(false),
    color: z.string().max(32).nullable().default(null),
  })
  .refine(dateRange, { message: '종료일은 시작일 이후여야 한다', path: ['endDate'] })
  .refine((v) => v.amId === null || v.amId !== v.pmId, { message: 'PM과 AM은 다른 사람이어야 한다', path: ['amId'] });
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

export const listEventsQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  clientId: uuid.optional(),
  status: eventStatus.optional(),
});
export type ListEventsQuery = z.infer<typeof listEventsQuery>;

export const eventMemberRole = z.enum(['pm', 'am', 'member']);
export const eventMemberDto = z.object({ eventId: uuid, userId: uuid, role: eventMemberRole });
export type EventMemberDto = z.infer<typeof eventMemberDto>;

export const addEventMemberBody = z.object({ userId: uuid, role: eventMemberRole.default('member') });
export type AddEventMemberBody = z.infer<typeof addEventMemberBody>;
export const changeEventMemberRoleBody = z.object({ role: eventMemberRole });
export type ChangeEventMemberRoleBody = z.infer<typeof changeEventMemberRoleBody>;
export { expectedVersion };
