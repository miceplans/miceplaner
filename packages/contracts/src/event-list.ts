import { z } from 'zod';
import { isoDate, isoDateTime, uuid } from './common';
import { dayMinute, productPart } from './event-item';

// 행사 상세의 제작물(디자인 요청) 표와 캘린더 일정 블록. 웹이 만든 uuid로 식별하고 행 단위로 통째로 저장한다(마지막 저장 우선).

export const productStatus = z.enum(['draft', 'pending', 'success', 'reject']);
const shortText = z.string().max(200);

export const saveEventProductBody = z.object({
  name: shortText,
  part: productPart,
  dueOn: isoDate.nullable(),
  size: shortText,
  qty: shortText,
  material: shortText,
  vendor: shortText,
  contact: shortText,
  note: z.string().max(2000),
  negotiating: z.boolean(),
  status: productStatus,
});
export type SaveEventProductBody = z.infer<typeof saveEventProductBody>;

export const eventProductDto = saveEventProductBody.extend({ id: uuid, eventId: uuid, updatedAt: isoDateTime });
export type EventProductDto = z.infer<typeof eventProductDto>;

export const saveEventCalendarBlockBody = z
  .object({ title: z.string().trim().min(1).max(200), date: isoDate, startMinute: dayMinute, endMinute: dayMinute })
  .refine((v) => v.endMinute > v.startMinute, { message: '종료 시각은 시작 시각 이후여야 한다', path: ['endMinute'] });
export type SaveEventCalendarBlockBody = z.infer<typeof saveEventCalendarBlockBody>;

export const eventCalendarBlockDto = z.object({
  id: uuid, eventId: uuid, title: z.string(), date: isoDate, startMinute: dayMinute, endMinute: dayMinute, updatedAt: isoDateTime,
});
export type EventCalendarBlockDto = z.infer<typeof eventCalendarBlockDto>;

export const eventListEntryParams = z.object({ eventId: uuid, id: uuid });
