import { z } from 'zod';
import { LEAVE_KINDS, isWeekend } from '@miceplans/domain';
import { isoDate, isoDateTime, uuid } from './common';

export const leaveKind = z.enum(LEAVE_KINDS);

export const leaveRecordDto = z.object({
  id: uuid,
  userId: uuid,
  date: isoDate,
  kind: leaveKind,
  days: z.number(),
  createdAt: isoDateTime,
});
export type LeaveRecordDto = z.infer<typeof leaveRecordDto>;

/** 연차 사용 현황 한 줄. used는 대휴를 제외한 사용 일수이고 monthly는 1~12월 사용 일수다. */
export const leaveBalanceDto = z.object({
  userId: uuid,
  name: z.string(),
  jobTitle: z.string(),
  total: z.number(),
  used: z.number(),
  monthly: z.array(z.number()).length(12),
  compEarned: z.number(),
  compUsed: z.number(),
});
export type LeaveBalanceDto = z.infer<typeof leaveBalanceDto>;

export const listLeaveQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12).optional() });
export type ListLeaveQuery = z.infer<typeof listLeaveQuery>;
export const leaveBalancesQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100) });
export type LeaveBalancesQuery = z.infer<typeof leaveBalancesQuery>;

const weekday = isoDate.refine((d) => !isWeekend(d), '주말에는 휴가를 신청할 수 없다');

/** 기간 신청은 평일마다 한 건씩 만든다. 반차·반반차는 하루만 신청한다. */
export const requestLeaveBody = z
  .object({ kind: leaveKind, startDate: weekday, endDate: weekday })
  .refine((v) => v.endDate >= v.startDate, { message: '종료일은 시작일 이후여야 한다', path: ['endDate'] })
  .refine((v) => v.kind === 'full' || v.kind === 'comp' || v.startDate === v.endDate, { message: '반차·반반차는 하루만 신청할 수 있다', path: ['endDate'] });
export type RequestLeaveBody = z.infer<typeof requestLeaveBody>;

/** 토·일 근무 체크. 근무 1일당 대휴 1일이 생긴다. */
export const weekendWorkBody = z.object({ date: isoDate.refine(isWeekend, '주말 날짜여야 한다'), worked: z.boolean() });
export type WeekendWorkBody = z.infer<typeof weekendWorkBody>;
export const weekendWorkDto = z.object({ dates: z.array(isoDate) });
