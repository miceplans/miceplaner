import { z } from 'zod';
import { isoDateTime, uuid } from './common';
import { userDto } from './user';

const email = z.string().trim().toLowerCase().email().max(254);
/** 길이만 강제한다(NIST 권고). 구성 규칙은 두지 않는다. */
const password = z.string().min(8, '비밀번호는 8자 이상이어야 한다').max(128);

/** 이메일·비밀번호 로그인 (명세 F-01). */
export const loginBody = z.object({ email, password: z.string().min(1).max(128) });
export type LoginBody = z.infer<typeof loginBody>;

/** 하이웍스 구성원 이메일만 가입할 수 있다. 이름은 하이웍스 값을 쓴다. */
export const registerBody = z.object({ email, password });
export type RegisterBody = z.infer<typeof registerBody>;

export const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;

/** Client 포털 계정은 회사명과 함께 신청한 뒤 내부 관리자의 승인을 받아 활성화한다. */
export const createClientApplicationBody = z.object({
  companyName: z.string().trim().min(1).max(120),
  applicantName: z.string().trim().min(1).max(80),
  email,
  password,
});
export type CreateClientApplicationBody = z.infer<typeof createClientApplicationBody>;

export const clientApplicationDto = z.object({
  id: uuid,
  companyName: z.string(),
  applicantName: z.string(),
  email,
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: isoDateTime,
  decidedAt: isoDateTime.nullable(),
});
export type ClientApplicationDto = z.infer<typeof clientApplicationDto>;

export const authSessionDto = z.object({ accessToken: z.string(), user: userDto });
export type AuthSessionDto = z.infer<typeof authSessionDto>;
