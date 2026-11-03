import { jwtVerify } from 'jose';
import { getUserById, withContext, type DbContext, type Pool } from '@miceplans/db';
import { isRole } from '@miceplans/domain';
import { config } from './config';

export type CollabUser = DbContext & { name: string };

/** 사용자 id로 현재 DB의 역할을 확인한다. API의 JwtAuthGuard와 같이 삭제된 사용자·바뀐 역할을 즉시 반영한다. */
export async function resolveUser(pool: Pool, userId: string): Promise<CollabUser | undefined> {
  // users_select 정책이 본인 행을 항상 허용하므로 임시 역할로 본인 행을 읽는다.
  const row = await withContext(pool, { workspaceId: config.workspaceId, userId, role: 'staff' }, (db) => getUserById(db, userId)).catch(() => undefined);
  return row && isRole(row.role) ? { workspaceId: config.workspaceId, userId: row.id, role: row.role, name: row.name } : undefined;
}

/** 세션 토큰을 검증해 사용자를 돌려준다. 유효하지 않으면 undefined다. */
export async function authenticate(pool: Pool, token: string): Promise<CollabUser | undefined> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(config.jwtSecret));
    return payload.sub ? await resolveUser(pool, payload.sub) : undefined;
  } catch {
    return undefined;
  }
}
