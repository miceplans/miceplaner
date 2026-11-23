import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hitRateLimit, withContext } from '../src';

const withPublicContext = <T>(pool: pg.Pool, workspaceId: string, fn: (db: pg.PoolClient) => Promise<T>) => withContext(pool, { workspaceId, userId: '', role: 'client' }, fn);

let app: pg.Pool;

beforeAll(() => {
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(() => app.end());

describe('요청 제한 카운터', () => {
  it('한도까지 허용하고 넘으면 거부하며 키마다 따로 센다', async () => {
    const hit = (key: string) => withPublicContext(app, 'w1', (db) => hitRateLimit(db, key, 600, 2));
    expect([await hit('db:a'), await hit('db:a'), await hit('db:a'), await hit('db:a')]).toEqual([true, true, false, false]);
    expect(await hit('db:b')).toBe(true);
  });

  it('앱 역할은 테이블을 직접 읽거나 쓸 수 없다', async () => {
    await expect(withPublicContext(app, 'w1', (db) => db.query('SELECT * FROM rate_limits'))).rejects.toMatchObject({ code: '42501' });
    await expect(withPublicContext(app, 'w1', (db) => db.query(`INSERT INTO rate_limits (key, window_start) VALUES ('x', now())`))).rejects.toMatchObject({ code: '42501' });
    await expect(withPublicContext(app, 'w1', (db) => db.query(`DELETE FROM rate_limits`))).rejects.toMatchObject({ code: '42501' });
  });

  it('잘못된 인자는 거부한다', async () => {
    await expect(withPublicContext(app, 'w1', (db) => hitRateLimit(db, 'k', 0, 1))).rejects.toThrow();
    await expect(withPublicContext(app, 'w1', (db) => hitRateLimit(db, 'k'.repeat(201), 60, 1))).rejects.toThrow();
    await expect(withPublicContext(app, 'w1', (db) => hitRateLimit(db, '', 60, 1))).rejects.toMatchObject({ code: '22023' });
    await expect(withPublicContext(app, 'w1', (db) => hitRateLimit(db, 'k', 86_401, 1))).rejects.toMatchObject({ code: '22023' });
    await expect(withPublicContext(app, 'w1', (db) => hitRateLimit(db, 'k', 60, 0))).rejects.toMatchObject({ code: '22023' });
    await expect(withPublicContext(app, 'w1', (db) => db.query(`SELECT hit_rate_limit(NULL, 60, 1)`))).rejects.toMatchObject({ code: '22023' });
  });

  it('로그인한 사용자 컨텍스트(AI 질의 한도)에서도 같은 함수로 센다', async () => {
    const member = { workspaceId: 'w1', userId: '00000000-0000-4000-8000-0000000000d1', role: 'staff' as const };
    const hit = () => withContext(app, member, (db) => hitRateLimit(db, 'ai-chat:user:db-test', 60, 1));
    expect([await hit(), await hit()]).toEqual([true, false]);
  });

  it('같은 이름의 임시 테이블로 카운터를 가로챌 수 없다 (search_path 고정)', async () => {
    const result = await withPublicContext(app, 'w1', async (db) => {
      await db.query(`CREATE TEMP TABLE rate_limits (key text, window_start timestamptz, hits integer NOT NULL DEFAULT 0, PRIMARY KEY (key, window_start)) ON COMMIT DROP`);
      const hits = [await hitRateLimit(db, 'db:shadow', 600, 1), await hitRateLimit(db, 'db:shadow', 600, 1)];
      const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_temp.rate_limits`);
      return { hits, shadowRows: rows[0]!.n };
    });
    expect(result).toEqual({ hits: [true, false], shadowRows: 0 });
  });

  it('함수는 고정된 search_path를 가진 SECURITY DEFINER다', async () => {
    const admin = new pg.Client({ connectionString: process.env.TEST_PG_ADMIN_URL });
    await admin.connect();
    try {
      const { rows } = await admin.query<{ prosecdef: boolean; proconfig: string[] }>(`SELECT prosecdef, proconfig FROM pg_proc WHERE proname = 'hit_rate_limit'`);
      expect(rows).toEqual([{ prosecdef: true, proconfig: ['search_path=pg_catalog, pg_temp'] }]);
    } finally {
      await admin.end();
    }
  });
});
