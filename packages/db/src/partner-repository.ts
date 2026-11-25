import type { PoolClient } from 'pg';
import { isoTs } from './sql';

// 외부 협력사 (명세 F-14). 조회·쓰기 권한(내부 직원)은 RLS가 강제한다.

export type PartnerRow = { id: string; name: string; field: string; manager: string; phone: string; email: string; memo: string; updatedAt: string };
export type PartnerInput = Omit<PartnerRow, 'updatedAt'>;
export type PartnerFieldRow = { id: string; name: string };

const COLUMNS = `id, name, field, manager, phone, email, memo, ${isoTs('updated_at', 'updatedAt')}`;

export async function listPartners(client: PoolClient): Promise<PartnerRow[]> {
  const { rows } = await client.query<PartnerRow>(`SELECT ${COLUMNS} FROM partners WHERE deleted_at IS NULL ORDER BY name, id`);
  return rows;
}

/** 없으면 만들고 있으면 덮어쓴다. 이미 삭제된 id면 거부된다(RLS) 또는 undefined다. */
export async function savePartner(client: PoolClient, actorId: string, p: PartnerInput): Promise<PartnerRow | undefined> {
  const { rows } = await client.query<PartnerRow>(
    `INSERT INTO partners AS t (id, name, field, manager, phone, email, memo, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, field = EXCLUDED.field, manager = EXCLUDED.manager, phone = EXCLUDED.phone,
       email = EXCLUDED.email, memo = EXCLUDED.memo, updated_by = EXCLUDED.updated_by
     WHERE t.deleted_at IS NULL
     RETURNING ${COLUMNS}`,
    [p.id, p.name, p.field, p.manager, p.phone, p.email, p.memo, actorId],
  );
  return rows[0];
}

export async function deletePartner(client: PoolClient, id: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>('SELECT soft_delete_partner($1) AS ok', [id]);
  return rows[0]!.ok;
}

export async function listPartnerFields(client: PoolClient): Promise<PartnerFieldRow[]> {
  const { rows } = await client.query<PartnerFieldRow>('SELECT id, name FROM partner_fields WHERE deleted_at IS NULL ORDER BY created_at, id');
  return rows;
}

export async function createPartnerField(client: PoolClient, name: string): Promise<PartnerFieldRow> {
  const { rows } = await client.query<PartnerFieldRow>('INSERT INTO partner_fields (name) VALUES ($1) RETURNING id, name', [name]);
  return rows[0]!;
}

/** 태그 이름을 바꾸면 그 태그를 쓰는 협력사의 분야도 같은 트랜잭션에서 바꾼다. 없으면 undefined. */
export async function renamePartnerField(client: PoolClient, actorId: string, id: string, name: string): Promise<PartnerFieldRow | undefined> {
  const before = await client.query<PartnerFieldRow>('SELECT id, name FROM partner_fields WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [id]);
  const old = before.rows[0];
  if (!old) return undefined;
  const { rows } = await client.query<PartnerFieldRow>('UPDATE partner_fields SET name = $2 WHERE id = $1 RETURNING id, name', [id, name]);
  await client.query('UPDATE partners SET field = $2, updated_by = $3 WHERE field = $1 AND deleted_at IS NULL', [old.name, name, actorId]);
  return rows[0];
}

export async function deletePartnerField(client: PoolClient, id: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: boolean }>('SELECT soft_delete_partner_field($1) AS ok', [id]);
  return rows[0]!.ok;
}
