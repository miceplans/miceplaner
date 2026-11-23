import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { databaseCaCert, pgConnectionConfig } from './connection';

/** pg가 연결 문자열과 설정 객체를 합치는 내부 구현. 타입 정의가 없어 require로 읽는다. */
const ConnectionParameters = createRequire(import.meta.url)('pg/lib/connection-parameters.js') as new (config: unknown) => { ssl: unknown };

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----';
const POOLER = 'postgresql://miceplans_app.ref:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';

/** pg가 실제로 쓰는 ssl 값. 연결 문자열과 ssl 객체를 pg와 같은 방식으로 합친 결과다. */
const effectiveSsl = (config: { connectionString: string; ssl?: unknown }) => new ConnectionParameters(config).ssl;

describe('DATABASE_CA_CERT', () => {
  it('한 줄로 넣은 \\n 이스케이프를 줄바꿈으로 바꾼다', () => {
    expect(databaseCaCert({ DATABASE_CA_CERT: PEM.replace(/\n/g, '\\n') })).toBe(PEM);
    expect(databaseCaCert({ DATABASE_CA_CERT: `  ${PEM}\n` })).toBe(PEM);
    expect(databaseCaCert({})).toBeUndefined();
  });

  it('PEM 인증서가 아니면 거부한다', () => {
    expect(() => databaseCaCert({ DATABASE_CA_CERT: 'not-a-cert' })).toThrow(/PEM/);
  });
});

describe('pgConnectionConfig', () => {
  it('CA가 있으면 연결 문자열의 sslmode·workaround를 지우고 CA로 검증한다 (pg가 ssl 객체를 덮어쓰지 않는다)', () => {
    const config = pgConnectionConfig(`${POOLER}?sslmode=require&workaround=supabase-pooler.vercel&application_name=api`, { DATABASE_CA_CERT: PEM, NODE_ENV: 'production' });
    expect(config.connectionString).toBe(`${POOLER}?application_name=api`);
    expect(config.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(effectiveSsl(config)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it('sslmode를 남겨 두면 pg가 CA 없는 ssl로 덮어쓴다는 전제를 확인한다', () => {
    expect(effectiveSsl({ connectionString: `${POOLER}?sslmode=require`, ssl: { ca: PEM, rejectUnauthorized: true } })).toEqual({});
  });

  it('CA가 있으면 sslmode=disable이어도 TLS로 검증한다', () => {
    expect(pgConnectionConfig(`${POOLER}?sslmode=disable`, { DATABASE_CA_CERT: PEM }).ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it('검증을 끄는 no-verify는 거부한다', () => {
    expect(() => pgConnectionConfig(`${POOLER}?sslmode=no-verify`, { DATABASE_CA_CERT: PEM })).toThrow(/no-verify/);
    expect(() => pgConnectionConfig(`${POOLER}?ssl=no-verify`, {})).toThrow(/no-verify/);
  });

  it('운영에서 CA도 TLS 요구도 없으면 평문으로 붙지 않고 실패한다', () => {
    expect(() => pgConnectionConfig(POOLER, { NODE_ENV: 'production' })).toThrow(/TLS/);
    expect(() => pgConnectionConfig(`${POOLER}?workaround=supabase-pooler.vercel`, { NODE_ENV: 'production' })).toThrow(/TLS/);
  });

  it('CA가 없으면 연결 문자열을 그대로 쓴다 (운영의 verify-full·명시적 disable, 개발의 로컬 DB)', () => {
    expect(pgConnectionConfig(`${POOLER}?sslmode=verify-full`, { NODE_ENV: 'production' })).toEqual({ connectionString: `${POOLER}?sslmode=verify-full` });
    expect(pgConnectionConfig('postgres://u@db:5432/app?sslmode=disable', { NODE_ENV: 'production' }).ssl).toBeUndefined();
    expect(pgConnectionConfig('postgres://miceplans_app@127.0.0.1:5432/postgres', {})).toEqual({ connectionString: 'postgres://miceplans_app@127.0.0.1:5432/postgres' });
  });
});
