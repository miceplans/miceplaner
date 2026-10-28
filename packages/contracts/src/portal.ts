import { z } from 'zod';
import { isoDate, uuid } from './common';

/** Client 포털 전용 계약. 내부 도메인 계약을 import하지 않는다 (명세 F-07). */
export const portalEventDto = z.object({ eventId: uuid, name: z.string(), startDate: isoDate, endDate: isoDate, place: z.string() });
export const portalProgramDto = z.object({ eventId: uuid, programId: uuid, title: z.string(), startsOn: isoDate.nullable(), dueOn: isoDate.nullable() });
export type PortalEventDto = z.infer<typeof portalEventDto>;
export type PortalProgramDto = z.infer<typeof portalProgramDto>;
