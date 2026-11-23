import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { EMPTY_SCHEDULE_NOTE, scheduleNoteContent, scheduleNoteDto, type SaveScheduleNoteBody, type ScheduleNoteDto } from '@miceplans/contracts';
import { getScheduleNote, saveScheduleNote, withContext, type ScheduleNoteRow } from '@miceplans/db';
import type { Pool } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { mapDbError, versionConflictError } from '../common/http';
import { DB_POOL } from '../tokens';

/** 저장값에 빠진 필드는 빈 값으로 채워 돌려준다. */
const toDto = (row: ScheduleNoteRow): ScheduleNoteDto =>
  scheduleNoteDto.parse({ ...row, content: scheduleNoteContent.parse({ ...EMPTY_SCHEDULE_NOTE, ...row.content }) });

@Injectable()
export class ScheduleNotesService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async get(user: AuthUser, key: string): Promise<ScheduleNoteDto> {
    requireInternal(user);
    const row = await withContext(this.pool, user, (db) => getScheduleNote(db, key)).catch((error) => mapDbError(error));
    return row ? toDto(row) : { key, eventId: null, content: EMPTY_SCHEDULE_NOTE, version: 0, updatedAt: null };
  }

  /** 행사에 묶인 메모는 행사 멤버만, 행사 없는 날짜 메모는 내부 직원 누구나 저장한다 (RLS). */
  async save(user: AuthUser, body: SaveScheduleNoteBody): Promise<ScheduleNoteDto> {
    requireInternal(user);
    const result = await withContext(this.pool, user, (db) =>
      saveScheduleNote(db, { key: body.key, eventId: body.eventId ?? null, baseVersion: body.baseVersion, patch: body.patch, actorId: user.userId }),
    ).catch((error) => mapDbError(error));
    if (result.kind === 'conflict') throw versionConflictError(result.currentVersion);
    if (result.kind === 'event_mismatch') throw new ConflictException('[409] 다른 행사에 연결된 일정입니다.');
    return toDto(result.row);
  }
}
