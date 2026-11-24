import type { PoolClient } from 'pg';
import { isoTs } from './sql';

export type ClientApplicationRow = {
  id: string;
  companyName: string;
  applicantName: string;
  email: string;
  passwordHash: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
};

const COLUMNS = `id, company_name AS "companyName", applicant_name AS "applicantName", email,
  password_hash AS "passwordHash", status, ${isoTs('created_at', 'createdAt')}, ${isoTs('decided_at', 'decidedAt')}`;

export async function createClientApplication(client: PoolClient, application: {
  id: string; companyName: string; applicantName: string; email: string; passwordHash: string;
}): Promise<ClientApplicationRow> {
  // 공개 신청 컨텍스트에는 SELECT 권한을 주지 않는다. RETURNING도 SELECT 정책을 요구하므로
  // UUID와 작성 시각은 API에서 만들고 INSERT만 수행한다.
  await client.query(
    `INSERT INTO client_applications (id, company_name, applicant_name, email, password_hash) VALUES ($1, $2, $3, $4, $5)`,
    [application.id, application.companyName, application.applicantName, application.email, application.passwordHash],
  );
  return { ...application, status: 'pending', createdAt: new Date().toISOString(), decidedAt: null };
}

export async function approveClientApplication(client: PoolClient, id: string, actorId: string): Promise<ClientApplicationRow | undefined> {
  const { rows } = await client.query<ClientApplicationRow>(
    `UPDATE client_applications SET status = 'approved', decided_by = $2, decided_at = now() WHERE id = $1 AND status = 'pending' RETURNING ${COLUMNS}`,
    [id, actorId],
  );
  return rows[0];
}

export type ClientAccountRow = {
  id: string;
  name: string;
  email: string;
  clientId: string | null;
  /** 가입 신청 때 적은 회사명. 신청 조회는 Super Admin만 가능하므로(RLS) 그 외에는 null이다. */
  companyName: string | null;
};

/** 승인된 Client 계정 목록. 내부 직원만 조회한다 (users_select RLS). */
export async function listClientAccounts(client: PoolClient): Promise<ClientAccountRow[]> {
  const { rows } = await client.query<ClientAccountRow>(
    `SELECT u.id, u.name, u.email, u.client_id AS "clientId", a.company_name AS "companyName"
     FROM users u
     LEFT JOIN client_applications a ON a.email = u.email AND a.status = 'approved'
     WHERE u.role = 'client'
     ORDER BY u.name, u.email`,
  );
  return rows;
}

/** Client 계정을 고객사에 연결하거나(null이면) 해제한다. 권한 검증·감사 로그는 DB 함수가 한다. */
export async function linkClientAccount(client: PoolClient, userId: string, clientId: string | null): Promise<ClientAccountRow | undefined> {
  await client.query(`SELECT link_client_account($1, $2)`, [userId, clientId]);
  return (await listClientAccounts(client)).find((row) => row.id === userId);
}

/** 신청 회사명과 이름이 정확히 하나만 일치하는 고객사(공백·대소문자 무시). 없거나 여러 개면 undefined다. */
export async function findClientIdByCompanyName(client: PoolClient, companyName: string): Promise<string | undefined> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM clients WHERE deleted_at IS NULL AND lower(btrim(name)) = lower(btrim($1)) LIMIT 2`,
    [companyName],
  );
  return rows.length === 1 ? rows[0]!.id : undefined;
}
