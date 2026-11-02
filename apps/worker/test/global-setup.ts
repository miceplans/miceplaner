import { startTestPostgres } from '@miceplans/db/testing';
import { migrateQueue } from '@miceplans/queue';

/** 실제 PostgreSQL 임시 클러스터를 띄우고 pg-boss 스키마까지 준비한다. */
export default async function setup() {
  const pg = await startTestPostgres();
  await migrateQueue(pg.adminUrl);
  process.env.DATABASE_URL = pg.appUrl;
  process.env.TEST_PG_ADMIN_URL = pg.adminUrl;
  return pg.stop;
}
