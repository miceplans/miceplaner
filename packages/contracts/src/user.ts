import { z } from 'zod';
import { ROLES } from '@miceplans/domain';
import { uuid } from './common';

/** 워크스페이스 전역 역할. PM·AM·행사 멤버는 행사 단위(event_members) 역할이라 여기 없다 (명세 2.1). */
export const userRole = z.enum(['super_admin', 'staff', 'client']);
export type UserRole = z.infer<typeof userRole>;

/** `team`·`subTeam`은 하이웍스 조직도에서 온 값이라 `GET /auth/me`와 세션에만 채운다. 하이웍스 조회에 실패하면 비어 있다. */
export const userDto = z.object({
  id: uuid,
  name: z.string(),
  email: z.string(),
  jobTitle: z.string(),
  role: z.enum(ROLES),
  team: z.string().optional(),
  subTeam: z.string().optional(),
});
export type UserDto = z.infer<typeof userDto>;

export const employmentStatus = z.enum(['active', 'departed']);
export type EmploymentStatus = z.infer<typeof employmentStatus>;

/** 대표가 보는 직원 계정 관리 목록. Client 계정은 이 목록에서 제외한다. `team`·`subTeam`은 하이웍스 조직도 값이며 조회에 실패하면 비어 있다. */
export const staffAccountDto = z.object({
  id: uuid,
  name: z.string(),
  email: z.string(),
  jobTitle: z.string(),
  team: z.string().optional(),
  subTeam: z.string().optional(),
  role: z.enum(['super_admin', 'staff']),
  employmentStatus,
  joinedAt: z.string(),
  departedAt: z.string().nullable(),
});
export type StaffAccountDto = z.infer<typeof staffAccountDto>;

export const updateStaffAccountBody = z.object({
  role: z.enum(['super_admin', 'staff']).optional(),
  employmentStatus: employmentStatus.optional(),
  /** 직급은 하이웍스에 없어 대표가 직접 입력한다. 빈 문자열은 직급을 비운다. */
  jobTitle: z.string().trim().max(50).optional(),
}).refine((value) => value.role !== undefined || value.employmentStatus !== undefined || value.jobTitle !== undefined, '변경할 값을 입력하세요.');
export type UpdateStaffAccountBody = z.infer<typeof updateStaffAccountBody>;

export const clientDto = z.object({ id: uuid, name: z.string() });
export type ClientDto = z.infer<typeof clientDto>;

/** 행사 생성 화면의 '+ 고객사' 입력으로 새 고객사를 만든다. 생성은 낮은 권한 이상만 허용한다(명세 F-02, 가져오기와 같은 범위). */
export const createClientBody = z.object({ name: z.string().trim().min(1).max(200) });
export type CreateClientBody = z.infer<typeof createClientBody>;

/** 승인된 Client 포털 계정과 연결된 고객사. `companyName`은 신청 때 적은 회사명이며 Super Admin에게만 채운다. */
export const clientAccountDto = z.object({
  id: uuid,
  name: z.string(),
  email: z.string(),
  clientId: uuid.nullable(),
  companyName: z.string().nullable(),
});
export type ClientAccountDto = z.infer<typeof clientAccountDto>;

/** Client 계정을 고객사에 연결한다. null이면 연결을 해제한다 (Super Admin, 감사 로그 대상). */
export const linkClientAccountBody = z.object({ clientId: uuid.nullable() });
export type LinkClientAccountBody = z.infer<typeof linkClientAccountBody>;
