import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { portalEventDto, portalProgramDto } from '@miceplans/contracts/portal';
import { portalEvents, portalPrograms, withContext } from '@miceplans/db';
import type { Pool } from '@miceplans/db';
import type { AuthUser } from '../common/auth';
import { mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';

/** Client 포털. 공개 전용 모델(portal_events·portal_programs)만 쓴다 (명세 F-07). */
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
}
