import { z } from 'zod';
import { ITEM_KINDS, ITEM_STATUSES, PRODUCT_PARTS } from '@miceplans/domain';
import { expectedVersion, isoDate, isoDateTime, uuid } from './common';

export const itemKind = z.enum(ITEM_KINDS);
export const itemStatus = z.enum(ITEM_STATUSES);
export const productPart = z.enum(PRODUCT_PARTS);

/** Program·Task·Subtask 공통 응답. Client에는 이 DTO를 쓰지 않고 portal 계약을 쓴다. */
export const eventItemDto = z.object({
  id: uuid,
  eventId: uuid,
  kind: itemKind,
  parentId: uuid.nullable(),
  title: z.string(),
  description: z.string(),
  part: productPart.nullable(),
  status: itemStatus,
  startsOn: isoDate.nullable(),
  dueOn: isoDate.nullable(),
  assigneeId: uuid.nullable(),
  clientVisible: z.boolean(),
  version: z.number().int().positive(),
  createdBy: uuid,
  completedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type EventItemDto = z.infer<typeof eventItemDto>;

const period = (v: { startsOn?: string | null; dueOn?: string | null }) => !v.startsOn || !v.dueOn || v.dueOn >= v.startsOn;
const periodIssue = { message: '마감일은 시작일 이후여야 한다', path: ['dueOn'] };

/** parentId는 Program이면 없어야 하고 Task·Subtask면 있어야 한다. 상위 종류 검증은 서버·DB가 한다. */
export const createItemBody = z
  .object({
    kind: itemKind,
    parentId: uuid.nullable().default(null),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).default(''),
    part: productPart.nullable().default(null),
    status: itemStatus.default('할 일'),
    startsOn: isoDate.nullable().default(null),
    dueOn: isoDate.nullable().default(null),
    assigneeId: uuid.nullable().default(null),
  })
  .refine((v) => (v.kind === 'program') === (v.parentId === null), { message: 'Program만 상위 항목이 없다', path: ['parentId'] })
  .refine(period, periodIssue);
export type CreateItemBody = z.infer<typeof createItemBody>;

/** 제목·설명·상태·파트는 마지막 저장 우선. 담당자·마감일·공개 상태는 별도 엔드포인트에서 version을 검사한다. */
export const updateItemBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000),
    part: productPart.nullable(),
    status: itemStatus,
    startsOn: isoDate.nullable(),
  })
  .partial();
export type UpdateItemBody = z.infer<typeof updateItemBody>;

export const assignItemBody = z.object({ assigneeId: uuid.nullable(), expectedVersion });
export type AssignItemBody = z.infer<typeof assignItemBody>;
export const rescheduleItemBody = z.object({ startsOn: isoDate.nullable(), dueOn: isoDate.nullable(), expectedVersion }).refine(period, periodIssue);
export type RescheduleItemBody = z.infer<typeof rescheduleItemBody>;
/** Program만 Client에 공개할 수 있다. 변경은 감사 로그 대상이다. */
export const setClientVisibleBody = z.object({ clientVisible: z.boolean(), expectedVersion });
export type SetClientVisibleBody = z.infer<typeof setClientVisibleBody>;

export const listItemsQuery = z.object({
  kind: itemKind.optional(),
  parentId: uuid.optional(),
  assigneeId: uuid.optional(),
  status: itemStatus.optional(),
  part: productPart.optional(),
});
export type ListItemsQuery = z.infer<typeof listItemsQuery>;
