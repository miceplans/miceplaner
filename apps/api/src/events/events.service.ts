import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eventDto, eventMemberDto, type ListEventsQuery, type UpdateEventBody } from '@miceplans/contracts';
import {
  addEventMember, changeEventMemberRole, eventRole, getEvent, listEventClients, listEventMembers, listEvents,
  removeEventMember, setEventClient, softDeleteEvent, updateEvent, withContext,
} from '@miceplans/db';
import { canDeleteEvent, canEditEventItems, canManageMembers } from '@miceplans/domain';
import type { Pool, PoolClient } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, assertOk, mapDbError } from '../common/http';
import { DB_POOL } from '../tokens';
import { REALTIME, type Realtime } from '../realtime/realtime.gateway';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(REALTIME) private readonly rt: Realtime,
  ) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  /** 대상 행사가 있는지 보고 현재 주체의 행사 역할로 권한을 검사한다. */
  private async requireEvent(db: PoolClient, eventId: string) {
    return assertFound(await getEvent(db, eventId), '행사');
  }

  private async requireRole(db: PoolClient, eventId: string, allowed: (role: Awaited<ReturnType<typeof eventRole>>) => boolean, message: string) {
    if (!allowed(await eventRole(db, eventId))) throw new ForbiddenException(message);
  }

  async list(user: AuthUser, query: ListEventsQuery) {
    requireInternal(user);
    const rows = await this.run(user, (db) => listEvents(db, query));
    return rows.map((r) => eventDto.parse(r));
  }

  async get(user: AuthUser, id: string) {
    requireInternal(user);
    const row = await this.run(user, (db) => getEvent(db, id));
    return eventDto.parse(assertFound(row, '행사'));
  }

  /** 일반 필드는 마지막 저장 우선 (명세 3.2). 행사 멤버만 수정한다 (명세 2.2). */
  async update(user: AuthUser, id: string, body: UpdateEventBody) {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      await this.requireEvent(db, id);
      await this.requireRole(db, id, canEditEventItems, '[403] 행사 멤버만 수정할 수 있습니다.');
      return assertFound(await updateEvent(db, id, body), '행사');
    });
    this.rt.eventChanged(id);
    return eventDto.parse(row);
  }

  /** 행사 삭제는 PM(과 Super Admin)만 하고 하위 항목도 함께 삭제된다 (명세 2.2, 3.1). */
  async remove(user: AuthUser, id: string) {
    requireInternal(user);
    await this.run(user, async (db) => {
      await this.requireEvent(db, id);
      await this.requireRole(db, id, canDeleteEvent, '[403] 행사 삭제는 PM만 할 수 있습니다.');
      assertOk(await softDeleteEvent(db, user.userId, id), '행사');
    });
    this.rt.eventChanged(id);
  }

  async members(user: AuthUser, eventId: string) {
    requireInternal(user);
    const rows = await this.run(user, (db) => listEventMembers(db, eventId));
    return rows.map((r) => eventMemberDto.parse(r));
  }

  /** 멤버 추가는 PM·AM(과 Super Admin)만 하고 당사자에게 알림이 간다 (명세 2.2, F-06). */
  async addMember(user: AuthUser, eventId: string, targetUserId: string, role: 'pm' | 'am' | 'member') {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      await this.requireEvent(db, eventId);
      await this.requireRole(db, eventId, canManageMembers, '[403] 멤버 관리는 PM·AM만 할 수 있습니다.');
      return addEventMember(db, user.userId, eventId, targetUserId, role);
    });
    this.rt.eventChanged(eventId);
    this.rt.notification(targetUserId);
    return eventMemberDto.parse(row);
  }

  async changeMemberRole(user: AuthUser, eventId: string, targetUserId: string, role: 'pm' | 'am' | 'member') {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      await this.requireEvent(db, eventId);
      await this.requireRole(db, eventId, canManageMembers, '[403] 멤버 관리는 PM·AM만 할 수 있습니다.');
      return assertFound(await changeEventMemberRole(db, user.userId, eventId, targetUserId, role), '행사 멤버');
    });
    this.rt.eventChanged(eventId);
    return eventMemberDto.parse(row);
  }

  async removeMember(user: AuthUser, eventId: string, targetUserId: string) {
    requireInternal(user);
    await this.run(user, async (db) => {
      await this.requireEvent(db, eventId);
      await this.requireRole(db, eventId, canManageMembers, '[403] 멤버 관리는 PM·AM만 할 수 있습니다.');
      assertOk(await removeEventMember(db, user.userId, eventId, targetUserId), '행사 멤버');
    });
    this.rt.eventChanged(eventId);
    this.rt.notification(targetUserId);
  }

  async clients(user: AuthUser, eventId: string) {
    requireInternal(user);
    return this.run(user, async (db) => {
      await this.requireEvent(db, eventId);
      await this.requireRole(db, eventId, canManageMembers, '[403] Client 목록은 PM·AM만 볼 수 있습니다.');
      return listEventClients(db, eventId);
    });
  }

  /** Client 지정·해제는 감사 로그 대상이다 (명세 3.1). */
  async setClient(user: AuthUser, eventId: string, targetUserId: string, assigned: boolean) {
    requireInternal(user);
    await this.run(user, async (db) => {
      await this.requireEvent(db, eventId);
      await this.requireRole(db, eventId, canManageMembers, '[403] Client 지정은 PM·AM만 할 수 있습니다.');
      await setEventClient(db, user.userId, eventId, targetUserId, assigned);
    });
    this.rt.eventChanged(eventId);
  }
}
