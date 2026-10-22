import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const PORT = 54000 + Math.floor(Math.random() * 900);
const bin = (name: string) => join(process.env.PG_BIN ?? '/opt/homebrew/opt/postgresql@16/bin', name);

/** 실제 PostgreSQL 임시 클러스터를 띄우고 마이그레이션을 적용한다. */
export default async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'miceplans-pg-'));
  execFileSync(bin('initdb'), ['-D', join(dir, 'data'), '-U', 'postgres', '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' });
  execFileSync(bin('pg_ctl'), ['-D', join(dir, 'data'), '-o', `-p ${PORT} -k ${dir} -c listen_addresses=127.0.0.1`, '-w', '-l', join(dir, 'log'), 'start'], { stdio: 'ignore' });

  const admin = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', database: 'postgres' });
  await admin.connect();
  const migrations = join(__dirname, '..', 'migrations');
  for (const file of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) await admin.query(readFileSync(join(migrations, file), 'utf8'));
  await admin.end();

  process.env.TEST_PG_ADMIN_URL = `postgres://postgres@127.0.0.1:${PORT}/postgres`;
  process.env.TEST_PG_APP_URL = `postgres://miceplans_app@127.0.0.1:${PORT}/postgres`;

  return () => {
    execFileSync(bin('pg_ctl'), ['-D', join(dir, 'data'), '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    rmSync(dir, { recursive: true, force: true });
  };
}
