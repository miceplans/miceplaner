import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestPostgres } from '@miceplans/db/testing';
import { migrateQueue } from '@miceplans/queue';

/** 실제 PostgreSQL 임시 클러스터를 띄우고 API 연결 환경을 준비한다. */
export default async function setup() {
  const pg = await startTestPostgres();
  await migrateQueue(pg.adminUrl);
  const files = mkdtempSync(join(tmpdir(), 'miceplans-files-'));
  process.env.FILES_DIR = files;
  process.env.DATABASE_URL = pg.appUrl;
  process.env.TEST_PG_ADMIN_URL = pg.adminUrl;
  process.env.JWT_SECRET = 'e2e-test-secret';
  return () => {
    pg.stop();
    rmSync(files, { recursive: true, force: true });
  };
}
