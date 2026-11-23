import type { PoolClient } from 'pg';

/** 고정 창 카운터를 하나 올리고 허용 여부를 돌려준다. 테이블에는 직접 접근하지 않고 DB 함수만 실행한다. */
export async function hitRateLimit(client: PoolClient, key: string, windowSeconds: number, limit: number): Promise<boolean> {
  const { rows } = await client.query<{ allowed: boolean }>(`SELECT hit_rate_limit($1, $2, $3) AS allowed`, [key, windowSeconds, limit]);
  return rows[0]?.allowed === true;
}
