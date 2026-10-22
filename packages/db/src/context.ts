import type { Pool, PoolClient } from 'pg';
import { isRole, type Role } from '@miceplans/domain';

export type DbContext = { workspaceId: string; userId: string; role: Role };

/** 요청·작업 단위 트랜잭션 안에서만 DB에 접근한다. RLS는 이 컨텍스트 값을 읽는다. */
export async function withContext<T>(pool: Pool, ctx: DbContext, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!isRole(ctx.role)) throw new Error(`알 수 없는 역할: ${String(ctx.role)}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.workspace_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true)`,
      [ctx.workspaceId, ctx.userId, ctx.role],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
