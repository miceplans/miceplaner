import { z } from 'zod';
import { isoDateTime, uuid } from './common';

// 외부 협력사 (명세 F-14). 웹이 만든 uuid로 식별하고 행 단위로 통째로 저장한다(마지막 저장 우선).

export const partnerFieldName = z.string().trim().min(1, '태그 이름을 입력하세요').max(40, '태그 이름은 40자를 넘을 수 없습니다').refine((v) => v !== '전체', "'전체'는 태그 이름으로 쓸 수 없습니다");

export const savePartnerBody = z.object({
  name: z.string().trim().min(1, '업체명을 입력하세요').max(200, '업체명은 200자를 넘을 수 없습니다'),
  field: z.string().trim().max(40),
  manager: z.string().trim().max(100, '담당자는 100자를 넘을 수 없습니다'),
  phone: z.string().trim().max(100, '연락처는 100자를 넘을 수 없습니다'),
  email: z.string().trim().max(200, '이메일은 200자를 넘을 수 없습니다'),
  memo: z.string().trim().max(2000, '메모는 2,000자를 넘을 수 없습니다'),
});
export type SavePartnerBody = z.infer<typeof savePartnerBody>;

export const partnerDto = z.object({
  id: uuid, name: z.string(), field: z.string(), manager: z.string(), phone: z.string(), email: z.string(), memo: z.string(), updatedAt: isoDateTime,
});
export type PartnerDto = z.infer<typeof partnerDto>;

export const savePartnerFieldBody = z.object({ name: partnerFieldName });
export type SavePartnerFieldBody = z.infer<typeof savePartnerFieldBody>;

export const partnerFieldDto = z.object({ id: uuid, name: z.string() });
export type PartnerFieldDto = z.infer<typeof partnerFieldDto>;
