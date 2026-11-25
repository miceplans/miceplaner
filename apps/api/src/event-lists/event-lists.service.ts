import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  eventCalendarBlockDto, eventProductDto, type EventCalendarBlockDto, type EventProductDto, type SaveEventCalendarBlockBody, type SaveEventProductBody,
} from '@miceplans/contracts';
import {
  deleteEventCalendarBlock, deleteEventProduct, eventRole, getEvent, getEventCalendarBlockEventId, getEventProductEventId, listEventCalendarBlocks,
  listEventProducts, saveEventCalendarBlock, saveEventProduct, withContext,
} from '@miceplans/db';
import { canEditEventItems } from '@miceplans/domain';
import type { Pool, PoolClient } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';

/**
 * 행사 상세의 제작물 표와 캘린더 일정 블록 (명세 F-04). 내부 직원은 모두 보고 행사 멤버만 쓴다.
 * 행은 웹이 만든 uuid로 통째로 저장하며 마지막 저장 우선이다. 권한은 여기와 RLS에서 모두 확인한다.
 */
@Injectable()
export class EventListsService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  private async requireEditor(db: PoolClient, eventId: string) {
    assertFound(await getEvent(db, eventId), '행사');
    if (!canEditEventItems(await eventRole(db, eventId))) throw new ForbiddenException('[403] 행사 멤버만 할 수 있습니다.');
  }

  async listProducts(user: AuthUser, eventId: string): Promise<EventProductDto[]> {
    requireInternal(user);
    const rows = await this.run(user, (db) => listEventProducts(db, eventId));
    return rows.map((r) => eventProductDto.parse(r));
  }

  async saveProduct(user: AuthUser, eventId: string, id: string, body: SaveEventProductBody): Promise<EventProductDto> {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      await this.requireEditor(db, eventId);
      return saveEventProduct(db, user.userId, eventId, { id, ...body });
    });
    if (!row) throw new ConflictException('[409] 다른 행사의 항목이거나 삭제된 항목입니다.');
    return eventProductDto.parse(row);
  }

  async removeProduct(user: AuthUser, eventId: string, id: string): Promise<void> {
    requireInternal(user);
    await this.run(user, async (db) => {
      if ((await getEventProductEventId(db, id)) !== eventId) throw new NotFoundException('[404] 제작물을 찾을 수 없습니다.');
      await this.requireEditor(db, eventId);
      if (!(await deleteEventProduct(db, id))) throw new NotFoundException('[404] 제작물을 찾을 수 없습니다.');
    });
  }

  async listBlocks(user: AuthUser, eventId: string): Promise<EventCalendarBlockDto[]> {
    requireInternal(user);
    const rows = await this.run(user, (db) => listEventCalendarBlocks(db, eventId));
    return rows.map((r) => eventCalendarBlockDto.parse(r));
  }

  async saveBlock(user: AuthUser, eventId: string, id: string, body: SaveEventCalendarBlockBody): Promise<EventCalendarBlockDto> {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      await this.requireEditor(db, eventId);
      return saveEventCalendarBlock(db, user.userId, eventId, { id, ...body });
    });
    if (!row) throw new ConflictException('[409] 다른 행사의 일정이거나 삭제된 일정입니다.');
    return eventCalendarBlockDto.parse(row);
  }

  async removeBlock(user: AuthUser, eventId: string, id: string): Promise<void> {
    requireInternal(user);
    await this.run(user, async (db) => {
      if ((await getEventCalendarBlockEventId(db, id)) !== eventId) throw new NotFoundException('[404] 일정을 찾을 수 없습니다.');
      await this.requireEditor(db, eventId);
      if (!(await deleteEventCalendarBlock(db, id))) throw new NotFoundException('[404] 일정을 찾을 수 없습니다.');
    });
  }
}
