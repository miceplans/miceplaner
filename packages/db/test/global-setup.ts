import { startTestPostgres } from '../src/testing';

/** 실제 PostgreSQL 임시 클러스터를 띄우고 마이그레이션을 적용한다. */
export default async function setup() {
  const pg = await startTestPostgres();
  process.env.TEST_PG_ADMIN_URL = pg.adminUrl;
  process.env.TEST_PG_APP_URL = pg.appUrl;
  return pg.stop;
}
