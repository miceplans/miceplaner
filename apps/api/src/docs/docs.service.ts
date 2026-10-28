import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eventDocDto, type SetDocVisibilityBody } from '@miceplans/contracts';
import { canChangeDocVisibility } from '@miceplans/domain';
import { eventRole, getDoc, listDocs, setDocVisibility, withContext } from '@miceplans/db';
import type { Pool, PoolClient } from '@miceplans/db';
import { AuthUser, requireInternal } from '../common/auth';
import { assertFound, mapDbError, versionConflictError } from '../common/http';
import { DB_POOL } from '../tokens';

/** 행사 위키 문서의 목록과 열람 범위 변경 (명세 F-09). 본문 편집은 협업 서버(Hocuspocus) 단계에서 다룬다. */
@Injectable()
export class DocsService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  private run<T>(user: AuthUser, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return withContext(this.pool, user, fn).catch((error) => mapDbError(error));
  }

  /** 목록에는 현재 사용자가 볼 수 있는 문서만 나온다 (RLS can_view_doc). */
  async list(user: AuthUser, eventId: string) {
    requireInternal(user);
    const rows = await this.run(user, (db) => listDocs(db, eventId));
    return rows.map((r) => eventDocDto.parse(r));
  }

  /** 열람 범위 변경은 PM·AM(과 Super Admin)만 하고 version 충돌을 검사한다 (명세 F-09). */
  async setVisibility(user: AuthUser, docId: string, body: SetDocVisibilityBody) {
    requireInternal(user);
    const row = await this.run(user, async (db) => {
      const doc = assertFound(await getDoc(db, docId), '문서');
      if (!canChangeDocVisibility(await eventRole(db, doc.eventId))) throw new ForbiddenException('열람 범위 변경은 PM·AM만 할 수 있다');
      const updated = await setDocVisibility(db, docId, body.visibility, body.expectedVersion, user.userId);
      if (!updated) throw versionConflictError((await getDoc(db, docId))?.version ?? body.expectedVersion);
      return updated;
    });
    return eventDocDto.parse(row);
  }
}
