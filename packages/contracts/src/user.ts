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

/** 행사 생성 화면의 '+ 고객사' 입력으로 새 고객사를 만든다. 생성은 낮은 권한 이상만 허용한다(명세 F-02, 가져오기와 같은 범위). */
export const createClientBody = z.object({ name: z.string().trim().min(1).max(200) });
export type CreateClientBody = z.infer<typeof createClientBody>;
