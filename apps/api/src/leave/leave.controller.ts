import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { leaveBalancesQuery, listLeaveQuery, requestLeaveBody, weekendWorkBody, type ListLeaveQuery, type RequestLeaveBody, type WeekendWorkBody } from '@miceplans/contracts';
import { Auth, type AuthUser } from '../common/auth';
import { ZodBody, ZodQuery } from '../common/zod';
import { LeaveService } from './leave.service';

@ApiTags('leave')
@Controller('leave')
export class LeaveController {
  constructor(@Inject(LeaveService) private readonly leave: LeaveService) {}

  @Get()
  @ApiOperation({ summary: '전 직원 휴가 사용 내역 (낮은 직원 전체 조회)' })
  list(@Auth() user: AuthUser, @ZodQuery(listLeaveQuery) query: ListLeaveQuery) {
    return this.leave.list(user, query);
  }

  @Get('balances')
  @ApiOperation({ summary: '연차 사용 현황 (used는 대휴 제외, 월별 합계 포함)' })
  balances(@Auth() user: AuthUser, @ZodQuery(leaveBalancesQuery) query: { year: number }) {
    return this.leave.balances(user, query.year);
  }

  @Post()
  @ApiOperation({ summary: '휴가 신청 (본인 명의, 주말 불가, 반차는 하루)' })
  request(@Auth() user: AuthUser, @ZodBody(requestLeaveBody) body: RequestLeaveBody) {
    return this.leave.request(user, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '휴가 신청 취소 (soft delete, 본인 것만)' })
  cancel(@Auth() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leave.cancel(user, id);
  }

  @Get('weekend-work')
  @ApiOperation({ summary: '내 주말 근무 목록 (대휴 발생 기준)' })
  weekendWork(@Auth() user: AuthUser) {
    return this.leave.weekendWork(user);
  }

  @Put('weekend-work')
  @ApiOperation({ summary: '주말 근무 체크·해제 (본인 것만)' })
  setWeekendWork(@Auth() user: AuthUser, @ZodBody(weekendWorkBody) body: WeekendWorkBody) {
    return this.leave.setWeekendWork(user, body);
  }
}
