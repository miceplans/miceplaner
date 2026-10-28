import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  eventItemDto, type AssignItemBody, type CreateItemBody, type ListItemsQuery, type RescheduleItemBody, type SetClientVisibleBody, type UpdateItemBody,
} from '@miceplans/contracts';
import {
  assignItem, createItem, eventRole, getEvent, getItem, listItems, rescheduleItem, setClientVisible, softDeleteItem, updateItem, withContext,
} from '@miceplans/db';
import { canEditEventItems } from '@miceplans/domain';
import type { Pool, PoolClient } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, assertOk, mapDbError, versionConflictError } from '../common/http';
import { DB_POOL } from '../tokens';
import { REALTIME, type Realtime } from '../realtime/realtime.gateway';

@Injectable()
export class ItemsService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(REALTIME) private readonly rt: Realtime,
  ) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  /** 행사 멤버 권한을 확인한다. */
  private async requireEditor(db: PoolClient, eventId: string) {
    if (!canEditEventItems(await eventRole(db, eventId))) throw new ForbiddenException('행사 멤버만 할 수 있다');
  }

  async list(user: AuthUser, eventId: string, query: ListItemsQuery) {
    requireInternal(user);
    const rows = await this.run(user, (db) => listItems(db, eventId, query));
    return rows.map((r) => eventItemDto.parse(r));
  }

  /** Program·Task·Subtask 생성. 상위 종류와 담당자(행사 멤버)는 DB가 검사한다 (명세 F-03). */
  async create(user: AuthUser, eventId: string, body: CreateItemBody) {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      assertFound(await getEvent(db, eventId), '행사');
      await this.requireEditor(db, eventId);
      return createItem(db, user.userId, { eventId, ...body });
    });
    this.rt.itemChanged(eventId, row.id);
    if (row.assigneeId) this.rt.notification(row.assigneeId);
    return eventItemDto.parse(row);
  }

  async get(user: AuthUser, itemId: string) {
    requireInternal(user);
    const row = await this.run(user, (db) => getItem(db, itemId));
    return eventItemDto.parse(assertFound(row, '항목'));
  }

  /** 제목·설명·파트·상태·시작일은 마지막 저장 우선. 완료 처리는 담당자(없으면 만든 사람)만 한다 (명세 3.1). */
  async update(user: AuthUser, itemId: string, patch: UpdateItemBody) {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      const item = assertFound(await getItem(db, itemId), '항목');
      await this.requireEditor(db, item.eventId);
      if (patch.status === '완료') {
        const closer = item.assigneeId ?? item.createdBy;
        if (closer !== user.userId) throw new ForbiddenException('완료 처리는 담당자만 할 수 있다');
      }
      return assertFound(await updateItem(db, itemId, patch), '항목');
    });
    this.rt.itemChanged(row.eventId, row.id);
    return eventItemDto.parse(row);
  }

  async assign(user: AuthUser, itemId: string, body: AssignItemBody) {
    requireInternal(user);
    let notify: string | undefined;
    const row = await this.run(user, async (db) => {
      const item = assertFound(await getItem(db, itemId), '항목');
      await this.requireEditor(db, item.eventId);
      const updated = await assignItem(db, user.userId, itemId, body.assigneeId, body.expectedVersion);
      if (!updated) throw versionConflictError((await getItem(db, itemId))?.version ?? body.expectedVersion);
      notify = updated.assigneeId ?? undefined;
      return updated;
    });
    this.rt.itemChanged(row.eventId, row.id);
    if (notify) this.rt.notification(notify);
    return eventItemDto.parse(row);
  }

  async reschedule(user: AuthUser, itemId: string, body: RescheduleItemBody) {
    requireInternal(user);
    let notify: string | undefined;
    const row = await this.run(user, async (db) => {
      const item = assertFound(await getItem(db, itemId), '항목');
      await this.requireEditor(db, item.eventId);
      const updated = await rescheduleItem(db, itemId, body.startsOn, body.dueOn, body.expectedVersion);
      if (!updated) throw versionConflictError((await getItem(db, itemId))?.version ?? body.expectedVersion);
      notify = updated.assigneeId ?? undefined;
      return updated;
    });
    this.rt.itemChanged(row.eventId, row.id);
    if (notify) this.rt.notification(notify);
    return eventItemDto.parse(row);
  }

  /** Program만 Client에 공개할 수 있고 변경은 감사 로그 대상이다 (명세 2.2, 3.1). */
  async setClientVisible(user: AuthUser, itemId: string, body: SetClientVisibleBody) {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      const item = assertFound(await getItem(db, itemId), '항목');
      if (item.kind !== 'program') throw new BadRequestException('Program만 Client에 공개할 수 있다');
      await this.requireEditor(db, item.eventId);
      const updated = await setClientVisible(db, user.userId, itemId, body.clientVisible, body.expectedVersion);
      if (!updated) throw versionConflictError((await getItem(db, itemId))?.version ?? body.expectedVersion);
      return updated;
    });
    this.rt.itemChanged(row.eventId, row.id);
    return eventItemDto.parse(row);
  }

  /** 삭제는 하위 항목까지 함께 적용된다 (명세 3.1). */
  async remove(user: AuthUser, itemId: string) {
    requireInternal(user);
    const removed = await this.run(user, async (db) => {
      const item = assertFound(await getItem(db, itemId), '항목');
      await this.requireEditor(db, item.eventId);
      assertOk(await softDeleteItem(db, itemId), '항목');
      return item;
    });
    this.rt.itemChanged(removed.eventId, removed.id);
  }
}
