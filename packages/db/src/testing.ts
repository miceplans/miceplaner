import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const bin = (name: string) => join(process.env.PG_BIN ?? '/opt/homebrew/opt/postgresql@16/bin', name);
const here = dirname(fileURLToPath(import.meta.url));

export type TestPostgres = { adminUrl: string; appUrl: string; stop: () => void };

/** 테스트가 마이그레이션 소유자 역할로 쓰는 최소 admin 연결. */
export type TestAdmin = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  end: () => Promise<void>;
};

export async function connectTestAdmin(url: string): Promise<TestAdmin> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client as unknown as TestAdmin;
}

/** 실제 PostgreSQL 임시 클러스터를 띄우고 마이그레이션을 적용한 뒤 접속 정보를 돌려준다. */
export async function startTestPostgres(): Promise<TestPostgres> {
  const port = 54000 + Math.floor(Math.random() * 900);
  const dir = mkdtempSync(join(tmpdir(), 'miceplans-pg-'));
  execFileSync(bin('initdb'), ['-D', join(dir, 'data'), '-U', 'postgres', '--auth=trust', '-E', 'UTF8'], { stdio: 'ignore' });
  execFileSync(bin('pg_ctl'), ['-D', join(dir, 'data'), '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c lc_messages=C`, '-w', '-l', join(dir, 'log'), 'start'], { stdio: 'ignore' });

  const admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  await admin.connect();
  const migrations = join(here, '..', 'migrations');
  for (const file of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) await admin.query(readFileSync(join(migrations, file), 'utf8'));
  await admin.end();

  return {
    adminUrl: `postgres://postgres@127.0.0.1:${port}/postgres`,
    appUrl: `postgres://miceplans_app@127.0.0.1:${port}/postgres`,
    stop: () => {
      execFileSync(bin('pg_ctl'), ['-D', join(dir, 'data'), '-m', 'immediate', 'stop'], { stdio: 'ignore' });
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
