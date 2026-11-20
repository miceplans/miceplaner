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
  });
});
