import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { clientAccountDto, clientDto, staffAccountDto, userDto, type UpdateStaffAccountBody } from '@miceplans/contracts';
import { canLinkClientAccount } from '@miceplans/domain';
import {
  createClient, linkClientAccount, listClientAccounts, listClients, listStaffAccounts, listUsers, updateStaffAccount, withContext,
} from '@miceplans/db';
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

  async staffAccounts(user: AuthUser) {
    if (user.role !== 'super_admin') throw new ForbiddenException('[403] 직원 계정 관리는 Super Admin만 할 수 있습니다.');
    const rows = await withContext(this.pool, user, (db) => listStaffAccounts(db)).catch((error) => mapDbError(error));
    return rows.map((row) => staffAccountDto.parse(row));
  }

  async updateStaffAccount(user: AuthUser, id: string, body: UpdateStaffAccountBody) {
    if (user.role !== 'super_admin') throw new ForbiddenException('[403] 직원 계정 관리는 Super Admin만 할 수 있습니다.');
    const row = await withContext(this.pool, user, (db) => updateStaffAccount(db, id, body)).catch((error) => mapDbError(error));
    if (!row) throw new NotFoundException('[404] 직원 계정을 찾을 수 없습니다.');
    return staffAccountDto.parse(row);
  }

  async createClient(user: AuthUser, name: string) {
    requireInternal(user);
    const row = await withContext(this.pool, user, (db) => createClient(db, name)).catch((error) => mapDbError(error));
    return clientDto.parse(row);
  }

  async clientAccounts(user: AuthUser) {
    requireInternal(user);
    const rows = await withContext(this.pool, user, (db) => listClientAccounts(db)).catch((error) => mapDbError(error));
    return rows.map((row) => clientAccountDto.parse(row));
  }

  async linkClientAccount(user: AuthUser, id: string, clientId: string | null) {
    if (!canLinkClientAccount(user.role)) throw new ForbiddenException('[403] Client 계정 연결은 Super Admin만 할 수 있습니다.');
    const row = await withContext(this.pool, user, (db) => linkClientAccount(db, id, clientId)).catch((error) => {
      if ((error as { code?: string }).code === 'P0002') throw new NotFoundException('[404] Client 계정 또는 고객사를 찾을 수 없습니다.');
      return mapDbError(error);
    });
    if (!row) throw new NotFoundException('[404] Client 계정을 찾을 수 없습니다.');
    return clientAccountDto.parse(row);
  }
}
