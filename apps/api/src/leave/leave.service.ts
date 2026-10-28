import { Inject, Injectable } from '@nestjs/common';
import { leaveBalanceDto, leaveRecordDto, weekendWorkDto, type ListLeaveQuery, type RequestLeaveBody, type WeekendWorkBody } from '@miceplans/contracts';
import { cancelLeave, leaveBalances, listLeave, listWeekendWork, requestLeave, setWeekendWork, withContext } from '@miceplans/db';
import { weekdaysBetween } from '@miceplans/domain';
import type { Pool } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { assertOk, mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';

/** 휴가·연차 (명세 F-12). 잔여 일수·중복·주말 규칙은 DB 제약이 강제한다. */
@Injectable()
export class LeaveService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async list(user: AuthUser, query: ListLeaveQuery) {
    requireInternal(user);
    const rows = await withContext(this.pool, user, (db) => listLeave(db, query.year, query.month)).catch((error) => mapDbError(error));
    return rows.map((r) => leaveRecordDto.parse(r));
  }

  async balances(user: AuthUser, year: number) {
    requireInternal(user);
    const rows = await withContext(this.pool, user, (db) => leaveBalances(db, year)).catch((error) => mapDbError(error));
    return rows.map((r) => leaveBalanceDto.parse(r));
  }

  /** 기간 신청은 평일마다 한 건씩 만든다. 잔여 일수 부족은 트랜잭션 전체를 롤백한다. */
  async request(user: AuthUser, body: RequestLeaveBody) {
    requireInternal(user);
    const dates = body.kind === 'full' || body.kind === 'comp' ? weekdaysBetween(body.startDate, body.endDate) : [body.startDate];
    const rows = await withContext(this.pool, user, (db) => requestLeave(db, user.userId, body.kind, dates)).catch((error) => mapDbError(error));
    return rows.map((r) => leaveRecordDto.parse(r));
  }

  /** 취소는 soft delete고 본인 것만 취소할 수 있다 (RLS). */
  async cancel(user: AuthUser, id: string) {
    requireInternal(user);
    const ok = await withContext(this.pool, user, (db) => cancelLeave(db, id)).catch((error) => mapDbError(error));
    assertOk(ok, '휴가 신청');
  }

  async weekendWork(user: AuthUser) {
    requireInternal(user);
    const dates = await withContext(this.pool, user, (db) => listWeekendWork(db)).catch((error) => mapDbError(error));
    return weekendWorkDto.parse({ dates });
  }

  /** 주말 근무 1일당 대휴 1일이 생긴다 (명세 F-12). */
  async setWeekendWork(user: AuthUser, body: WeekendWorkBody) {
    requireInternal(user);
    const dates = await withContext(this.pool, user, async (db) => {
      await setWeekendWork(db, user.userId, body.date, body.worked);
      return listWeekendWork(db);
    }).catch((error) => mapDbError(error));
    return weekendWorkDto.parse({ dates });
  }
}
