import { z } from 'zod';
import { DOC_VISIBILITIES } from '@miceplans/domain';
import { expectedVersion, uuid } from './common';

export const docVisibility = z.enum(DOC_VISIBILITIES);

export const eventDocDto = z.object({ id: uuid, eventId: uuid, title: z.string(), visibility: docVisibility, version: z.number().int().positive() });
export type EventDocDto = z.infer<typeof eventDocDto>;

/** 열람 범위 변경은 PM·AM과 Super Admin만 하고 version 충돌을 검사한다 (명세 F-09). */
export const setDocVisibilityBody = z.object({ visibility: docVisibility, expectedVersion });
export type SetDocVisibilityBody = z.infer<typeof setDocVisibilityBody>;
