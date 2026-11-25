import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { partnerDto, partnerFieldDto, type PartnerDto, type PartnerFieldDto, type SavePartnerBody } from '@miceplans/contracts';
import {
  createPartnerField, deletePartner, deletePartnerField, listPartnerFields, listPartners, renamePartnerField, savePartner, withContext,
} from '@miceplans/db';
import type { Pool, PoolClient } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, assertOk, mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';

/** 외부 협력사 (명세 F-14). 회사 공용 목록이라 내부 직원 전원이 보고 고친다. 권한은 여기와 RLS에서 모두 확인한다. */
@Injectable()
export class PartnersService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    requireInternal(user);
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  /** 같은 이름의 태그는 DB 유니크 인덱스가 막는다. 원문 대신 사용자가 알아볼 문구로 바꾼다. */
  private async saveField<T>(work: Promise<T>): Promise<T> {
    try {
      return await work;
    } catch (error) {
      if (error instanceof ConflictException && error.message.includes('partner_fields_name_uniq')) throw new ConflictException('[409] 같은 이름의 태그가 있습니다.');
      throw error;
    }
  }

  async list(user: AuthUser): Promise<PartnerDto[]> {
    return (await this.run(user, (db) => listPartners(db))).map((r) => partnerDto.parse(r));
  }

  async save(user: AuthUser, id: string, body: SavePartnerBody): Promise<PartnerDto> {
    const row = await this.run(user, (db) => savePartner(db, user.userId, { id, ...body }));
    if (!row) throw new ConflictException('[409] 이미 삭제된 협력사입니다.');
    return partnerDto.parse(row);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    assertOk(await this.run(user, (db) => deletePartner(db, id)), '협력사');
  }

  async listFields(user: AuthUser): Promise<PartnerFieldDto[]> {
    return (await this.run(user, (db) => listPartnerFields(db))).map((r) => partnerFieldDto.parse(r));
  }

  async createField(user: AuthUser, name: string): Promise<PartnerFieldDto> {
    return partnerFieldDto.parse(await this.saveField(this.run(user, (db) => createPartnerField(db, name))));
  }

  async renameField(user: AuthUser, id: string, name: string): Promise<PartnerFieldDto> {
    const row = await this.saveField(this.run(user, (db) => renamePartnerField(db, user.userId, id, name)));
    return partnerFieldDto.parse(assertFound(row, '태그'));
  }

  async removeField(user: AuthUser, id: string): Promise<void> {
    assertOk(await this.run(user, (db) => deletePartnerField(db, id)), '태그');
  }
}
