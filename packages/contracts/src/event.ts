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
  version: z.number().int().positive(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type EventDto = z.infer<typeof eventDto>;

const dateRange = (v: { startDate?: string; endDate?: string }) => !v.startDate || !v.endDate || v.endDate >= v.startDate;

/** 행사 생성 권한은 미확정(명세 6절)이라 API 노출 여부는 결정 후 정한다. */
export const createEventBody = z
  .object({
    clientId: uuid,
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
