import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { startTestPostgres, type TestPostgres } from '@miceplans/db/testing';
import { migrateQueue, openProducer, runWorker } from './index';

let db: TestPostgres;
const ctx = { workspaceId: 'w', userId: '00000000-0000-4000-8000-000000000001', role: 'member' as const };

beforeAll(async () => { db = await startTestPostgres(); await migrateQueue(db.adminUrl); }, 60_000);
afterAll(() => db.stop());

describe('pg-boss 큐', () => {
  it('앱 역할(DDL 권한 없음)이 작업을 넣고 worker가 받아 처리한다', async () => {
    const parsed: string[] = [];
    const embedded: string[] = [];
    const producer = await openProducer(db.appUrl);
    const fileId = '00000000-0000-4000-8000-0000000000aa';
    const docId = '00000000-0000-4000-8000-0000000000bb';
    await producer.enqueueParseFile({ fileId, ctx });
    await producer.enqueueEmbedDoc({ docId, ctx });
    await producer.enqueueEmbedDoc({ docId, ctx }); // 합쳐진다
    const worker = await runWorker(db.appUrl, { parseFile: async (j) => { parsed.push(j.fileId); }, embedDoc: async (j) => { embedded.push(j.docId); } });
    await expect.poll(() => parsed.length + embedded.length, { timeout: 15_000, interval: 200 }).toBeGreaterThanOrEqual(2);
    await new Promise((r) => setTimeout(r, 500));
    expect(parsed).toEqual([fileId]);
    expect(embedded).toEqual([docId]);
    await worker.stop();
    await producer.stop();
  }, 40_000);

  it('앱 역할은 pgboss 스키마를 만들 수 없다', async () => {
    const c = new pg.Client({ connectionString: db.appUrl });
    await c.connect();
    await expect(c.query('CREATE TABLE pgboss.hack (x int)')).rejects.toMatchObject({ code: '42501' });
    await c.end();
  });
});
