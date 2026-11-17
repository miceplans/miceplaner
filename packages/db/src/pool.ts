import { Pool } from 'pg';

export type { Pool, PoolClient } from 'pg';

/** 앱 진입점에서 쓰는 연결 풀 생성기. DB 클라이언트 사용을 packages/db 안에 두기 위한 유일한 진입점이다. */
export const createPool = (connectionString: string, max = 10): Pool => new Pool({ connectionString, max });
