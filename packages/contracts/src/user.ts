import { z } from 'zod';
import { ROLES } from '@miceplans/domain';
import { uuid } from './common';

/** 워크스페이스 전역 역할. PM·AM·행사 멤버는 행사 단위(event_members) 역할이라 여기 없다 (명세 2.1). */
export const userRole = z.enum(['super_admin', 'staff', 'client']);
export type UserRole = z.infer<typeof userRole>;

export const userDto = z.object({ id: uuid, name: z.string(), email: z.string(), jobTitle: z.string(), role: z.enum(ROLES) });
export type UserDto = z.infer<typeof userDto>;

export const clientDto = z.object({ id: uuid, name: z.string() });
export type ClientDto = z.infer<typeof clientDto>;
