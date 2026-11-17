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
