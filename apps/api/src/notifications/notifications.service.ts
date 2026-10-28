import { Inject, Injectable } from '@nestjs/common';
import { notificationDto, type ListNotificationsQuery, type MarkNotificationsReadBody } from '@miceplans/contracts';
import { listNotifications, markNotificationsRead, withContext } from '@miceplans/db';
import type { Pool } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  /** 알림은 본인 것만 볼 수 있다 (RLS). Client는 접근 자체가 금지다 (명세 2.2). */
  async list(user: AuthUser, query: ListNotificationsQuery) {
    requireInternal(user);
    const rows = await withContext(this.pool, user, (db) => listNotifications(db, query)).catch((error) => mapDbError(error));
    return rows.map((r) => notificationDto.parse(r));
  }

  async markRead(user: AuthUser, body: MarkNotificationsReadBody) {
    requireInternal(user);
    const updated = await withContext(this.pool, user, (db) => markNotificationsRead(db, body.ids)).catch((error) => mapDbError(error));
    return { updated };
  }
}
