import type { ConnectionOptions } from 'node:tls';

/** pg·pg-boss에 그대로 넘기는 접속 설정. */
export type PgConnectionConfig = { connectionString: string; ssl?: ConnectionOptions };

type Env = Record<string, string | undefined>;

/**
 * 연결 문자열에서 SSL을 정하는 파라미터. pg는 `Object.assign({}, config, parse(connectionString))`로 합치므로
 * 연결 문자열의 sslmode가 있으면 넘긴 `ssl` 객체(CA 포함)를 통째로 덮어쓴다. CA를 쓸 때는 이 파라미터들을 지우고 `ssl` 객체만 쓴다.
 * `workaround`는 pg가 해석하지 않는 값(예전 문서의 `workaround=supabase-pooler.vercel`)이라 함께 지운다.
 */
const SSL_URL_PARAMS = ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat', 'workaround'];
/** pg 8에서 서버 인증서를 검증하는 TLS를 요구하는 값(require·verify-ca도 verify-full로 취급된다). */
const TLS_SSLMODES = new Set(['require', 'verify-ca', 'verify-full']);

/**
 * DATABASE_CA_CERT의 PEM. 환경 변수에 한 줄로 넣을 수 있게 `\n` 이스케이프를 실제 줄바꿈으로 바꾼다.
 * 값이 있는데 PEM 인증서가 아니면 잘못된 설정이므로 바로 실패한다(검증을 끈 채 연결하지 않는다).
 */
export function databaseCaCert(env: Env = process.env): string | undefined {
  const raw = env.DATABASE_CA_CERT?.trim();
  if (!raw) return undefined;
  const pem = raw.replace(/\\n/g, '\n');
  if (!/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(pem)) {
    throw new Error('DATABASE_CA_CERT는 PEM 인증서(-----BEGIN CERTIFICATE-----)여야 한다');
  }
  return pem;
}

const parseUrl = (connectionString: string): URL => {
  try {
    return new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL은 postgres:// 형식의 URL이어야 한다');
  }
};

/**
 * pg Pool·Client와 pg-boss에 넘길 접속 설정을 만든다.
 * - DATABASE_CA_CERT가 있으면 연결 문자열의 SSL 파라미터를 지우고 `ssl: { ca, rejectUnauthorized: true }`로 인증서와 호스트 이름을 검증한다.
 *   Supabase 풀러 인증서는 Supabase 자체 루트 CA로 서명되어 시스템 CA로는 검증되지 않는다(SELF_SIGNED_CERT_IN_CHAIN).
 * - CA가 없으면 연결 문자열을 그대로 쓴다. 단 운영(NODE_ENV=production)에서 연결 문자열에 TLS 요구(sslmode=require·verify-full 등)가 없으면
 *   Supabase 풀러는 평문 접속을 받아 주므로 조용히 평문으로 붙지 않도록 바로 실패한다. 의도한 평문(같은 호스트의 로컬 DB)은 `sslmode=disable`을 명시한다.
 * 인증서 검증은 어떤 경우에도 끄지 않는다(`rejectUnauthorized: false`, `sslmode=no-verify`는 거부한다).
 */
export function pgConnectionConfig(connectionString: string, env: Env = process.env): PgConnectionConfig {
  const url = parseUrl(connectionString);
  const sslmode = url.searchParams.get('sslmode')?.toLowerCase();
  const sslParam = url.searchParams.get('ssl')?.toLowerCase();
  if (sslmode === 'no-verify' || sslParam === 'no-verify') throw new Error('sslmode=no-verify는 쓸 수 없다. DATABASE_CA_CERT로 서버 인증서를 검증한다');

  const ca = databaseCaCert(env);
  if (ca) {
    for (const name of SSL_URL_PARAMS) url.searchParams.delete(name);
    return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
  }

  const wantsTls = (sslmode !== undefined && TLS_SSLMODES.has(sslmode)) || sslParam === 'true' || sslParam === '1';
  if (env.NODE_ENV === 'production' && !wantsTls && sslmode !== 'disable') {
    throw new Error('운영 DB 연결에 TLS 설정이 없다. DATABASE_CA_CERT(Supabase 루트 CA)를 설정하거나 연결 문자열에 sslmode=verify-full을 둔다');
  }
  return { connectionString };
}
