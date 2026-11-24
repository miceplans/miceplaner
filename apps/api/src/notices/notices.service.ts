import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { noticeDto, type CreateNoticeBody } from '@miceplans/contracts';
import { createNotice, dismissNotice, eventRole, getEvent, getNotice, listNotices, softDeleteNotice, withContext } from '@miceplans/db';
import type { Pool, PoolClient } from '@miceplans/db';
import { canCreateEventNotice, canCreateGlobalNotice, canDeleteNotice } from '@miceplans/domain';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, assertOk, mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';
import { REALTIME, type Realtime } from '../realtime/realtime.client';

/** 공지 (명세 F-13). 작성은 관리자만, 받은 사람이 닫기 전까지 목록 최상단에 고정된다. */
@Injectable()
export class NoticesService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(REALTIME) private readonly rt: Realtime,
  ) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  /** 내가 받은 공지. 닫지 않은 공지가 최상단이고 RLS가 수신 범위를 거른다. */
  async list(user: AuthUser) {
    requireInternal(user);
    const rows = await this.run(user, (db) => listNotices(db));
    return rows.map((r) => noticeDto.parse(r));
  }

  /** 전체 공지는 Super Admin만, 행사 공지는 그 행사의 PM·AM(과 Super Admin)이 올린다. */
  async create(user: AuthUser, body: CreateNoticeBody) {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      if (body.eventId) {
        assertFound(await getEvent(db, body.eventId), '행사');
        if (!canCreateEventNotice(await eventRole(db, body.eventId))) {
          throw new ForbiddenException('[403] 이 행사의 공지는 PM·AM만 올릴 수 있습니다.');
        }
      } else if (!canCreateGlobalNotice(user.role)) {
        throw new ForbiddenException('[403] 전체 공지는 Super Admin만 올릴 수 있습니다.');
      }
      return createNotice(db, user.userId, body.eventId ?? null, body.title, body.body);
    });
    this.rt.noticeChanged(row.eventId);
    return noticeDto.parse(row);
  }

  /** 삭제는 soft delete고 작성자와 Super Admin만 한다. 감사 로그는 DB 함수가 남긴다. */
  async remove(user: AuthUser, id: string) {
    requireInternal(user);
    const eventId = await this.run(user, async (db) => {
      const notice = assertFound(await getNotice(db, id), '공지');
      if (!canDeleteNotice(user.role, notice.authorId, user.userId)) {
        throw new ForbiddenException('[403] 공지 삭제는 작성자와 Super Admin만 할 수 있습니다.');
      }
      assertOk(await softDeleteNotice(db, id), '공지');
      return notice.eventId;
    });
    this.rt.noticeChanged(eventId);
  }

  /** 닫기는 받은 사람만 하고 되돌리지 않는다. 닫으면 목록 최상단 고정이 풀린다. */
  async dismiss(user: AuthUser, id: string) {
    requireInternal(user);
    const row = await this.run(user, (db) => dismissNotice(db, user.userId, id));
    return noticeDto.parse(assertFound(row, '공지'));
  }
}
