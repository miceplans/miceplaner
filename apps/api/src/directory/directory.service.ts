import { Inject, Injectable } from '@nestjs/common';
import { clientDto, userDto } from '@miceplans/contracts';
import { listClients, listUsers, withContext } from '@miceplans/db';
import type { Pool } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';

/** 사용자·고객사 조회 (멤버 초대, 담당자 지정, 고객사 보기 화면용). */
@Injectable()
export class DirectoryService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async users(user: AuthUser) {
    requireInternal(user);
    const rows = await withContext(this.pool, user, (db) => listUsers(db)).catch((error) => mapDbError(error));
    return rows.map((r) => userDto.parse(r));
  }

  async clients(user: AuthUser) {
    requireInternal(user);
    const rows = await withContext(this.pool, user, (db) => listClients(db)).catch((error) => mapDbError(error));
    return rows.map((r) => clientDto.parse(r));
  }
}
