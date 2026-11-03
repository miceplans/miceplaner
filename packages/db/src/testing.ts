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
  if (process.env.TEST_PG_EXTERNAL_URL) return useExternalPostgres(process.env.TEST_PG_EXTERNAL_URL);
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

/**
 * pgvector가 든 서버처럼 로컬에 없는 확장이 필요한 검증용으로, 이미 떠 있는 서버(trust 인증)에 임시 데이터베이스를 만든다.
 * 예: docker run -e POSTGRES_HOST_AUTH_METHOD=trust -p 55432:5432 pgvector/pgvector:pg16 → TEST_PG_EXTERNAL_URL=postgres://postgres@127.0.0.1:55432/postgres
 */
async function useExternalPostgres(adminUrl: string): Promise<TestPostgres> {
  const db = `t${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const u = new URL(adminUrl);
  const boot = new pg.Client({ connectionString: adminUrl });
  await boot.connect();
  await boot.query(`CREATE DATABASE ${db}`);
  await boot.end();
  u.pathname = `/${db}`;
  const admin = new pg.Client({ connectionString: u.toString() });
  await admin.connect();
  const migrations = join(here, '..', 'migrations');
  for (const file of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) await admin.query(readFileSync(join(migrations, file), 'utf8'));
  await admin.end();
  const app = new URL(u.toString());
  app.username = 'miceplans_app';
  return {
    adminUrl: u.toString(),
    appUrl: app.toString(),
    stop: () => {
      // 외부 서버의 임시 데이터베이스는 호출 쪽이 서버째 버린다.
    },
  };
}
