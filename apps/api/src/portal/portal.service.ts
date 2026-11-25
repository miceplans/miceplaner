import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { portalEventDto, portalNotificationDto, portalProgramDto, publicEventDto, type MarkPortalNotificationsReadBody } from '@miceplans/contracts/portal';
import { markPortalNotificationsRead, portalEvents, portalNotifications, portalPrograms, publicEvents, withContext } from '@miceplans/db';
import type { Pool } from '@miceplans/db';
import type { AuthUser } from '../common/auth';
import { config } from '../config';
import { mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';

/** Client 포털. 공개 전용 모델(portal_events·portal_programs·portal_notifications)만 쓴다 (명세 F-07). */
@Injectable()
export class PortalService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  private requireClient(user: AuthUser) {
    if (user.role !== 'client') throw new ForbiddenException('[403] Client 포털은 Client만 사용할 수 있습니다.');
  }

  async events(user: AuthUser) {
    this.requireClient(user);
    const rows = await withContext(this.pool, user, (db) => portalEvents(db)).catch((error) => mapDbError(error));
    return rows.map((r) => portalEventDto.parse(r));
  }

  async programs(user: AuthUser) {
    this.requireClient(user);
    const rows = await withContext(this.pool, user, (db) => portalPrograms(db)).catch((error) => mapDbError(error));
    return rows.map((r) => portalProgramDto.parse(r));
  }

  /** Client 알림함. 내부 알림 채널(notifications·Socket.IO)은 쓰지 않는다 (명세 F-06·F-07). */
  async notifications(user: AuthUser) {
    this.requireClient(user);
    const rows = await withContext(this.pool, user, (db) => portalNotifications(db)).catch((error) => mapDbError(error));
    return rows.map((r) => portalNotificationDto.parse(r));
  }

  async markNotificationsRead(user: AuthUser, body: MarkPortalNotificationsReadBody) {
    this.requireClient(user);
    const updated = await withContext(this.pool, user, (db) => markPortalNotificationsRead(db, body.ids)).catch((error) => mapDbError(error));
    return { updated };
  }

  /**
   * 로그인 전 공개 캘린더. 신원이 없으므로 최소 권한(client) 익명 컨텍스트로 공개 전용 함수만 호출한다.
   * 공개 표시한 행사의 이름과 기간만 돌려준다 (명세 F-07, 2026-11-24 결정).
   */
  async publicEvents() {
    const rows = await withContext(this.pool, { workspaceId: config.workspaceId, userId: '', role: 'client' }, (db) => publicEvents(db)).catch((error) => mapDbError(error));
    return rows.map((r) => publicEventDto.parse(r));
  }
}
