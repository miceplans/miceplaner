import type { PoolClient } from 'pg';
import { isoTs } from './sql';
import type { EventStatus } from '@miceplans/domain';

/** 가져오기 매핑의 대상 속성. contracts의 importTargetFields와 같은 값이다 (db는 contracts를 런타임에 쓰지 않는다). */
export type ImportTargetField = 'name' | 'startDate' | 'endDate' | 'client' | 'pm' | 'status' | 'place';

export type ImportJobStatus = 'uploaded' | 'parsed' | 'previewed' | 'executing' | 'done' | 'failed';

export type ImportSheet = { name: string; rowCount: number };
export type ImportColumn = { index: number; label: string };
export type ImportPreviewRow = {
  row: number; name: string; startDate: string; endDate: string; client: string; pm: string; status: string; place: string; ok: boolean; issues: string[];
};
export type ImportValidation = { total: number; valid: number; invalid: number; rows: ImportPreviewRow[]; truncated: boolean };
export type ImportRowIssue = { row: number; message: string };
export type ImportResult = {
  created: number;
  failed: ImportRowIssue[];
  warnings: ImportRowIssue[];
  failedTruncated: boolean;
  warningsTruncated: boolean;
  finishedAt: string;
};

export type ImportJobRow = {
  id: string;
  fileName: string;
  status: ImportJobStatus;
  sheets: ImportSheet[];
  sheet: string | null;
  hasHeader: boolean | null;
  headerRow: number | null;
  columns: ImportColumn[] | null;
  dataRowCount: number | null;
  mapping: Record<string, ImportTargetField> | null;
  /** 엑셀 컬럼 대신 모든 행에 쓰는 고정값. */
  fixed: Partial<Record<ImportTargetField, string>> | null;
  validation: ImportValidation | null;
  result: ImportResult | null;
  error: string | null;
  createdAt: string;
};

const COLS = `id, file_name AS "fileName", status, sheets, sheet, has_header AS "hasHeader", header_row AS "headerRow",
  columns, data_row_count AS "dataRowCount", mapping, fixed_values AS fixed, validation, result, error, ${isoTs('created_at', 'createdAt')}`;

const toRow = (r: Record<string, unknown>): ImportJobRow => r as unknown as ImportJobRow;

export async function insertImportJob(
  client: PoolClient,
  job: { fileName: string; file: Buffer; sheets: ImportSheet[]; createdBy: string },
): Promise<ImportJobRow> {
  const { rows } = await client.query(
    `INSERT INTO import_jobs (file_name, file, sheets, created_by) VALUES ($1, $2, $3::jsonb, $4) RETURNING ${COLS}`,
    [job.fileName, job.file, JSON.stringify(job.sheets), job.createdBy],
  );
  return toRow(rows[0]!);
}

/** 본인 것만 RLS가 허용한다. 없으면 undefined다. */
export async function getImportJob(client: PoolClient, id: string): Promise<ImportJobRow | undefined> {
  const { rows } = await client.query(`SELECT ${COLS} FROM import_jobs WHERE id = $1`, [id]);
  return rows[0] ? toRow(rows[0]) : undefined;
}

/** 실행 시점의 원본 그리드다. 완료 후에는 지워져 있어 undefined다. */
export async function getImportJobFile(client: PoolClient, id: string): Promise<{ file: Buffer | null; rows: string[][] | null; rowNumbers: number[] | null } | undefined> {
  const { rows } = await client.query<{ file: Buffer | null; grid: string[][] | null; nums: number[] | null }>(
    `SELECT file, rows AS grid, row_numbers AS nums FROM import_jobs WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? { file: row.file, rows: row.grid, rowNumbers: row.nums } : undefined;
}

/** 시트 선택 뒤 파싱 결과(컬럼·그리드·행 번호)를 저장한다. */
export async function markImportJobParsed(
  client: PoolClient,
  id: string,
  parsed: { sheet: string; hasHeader: boolean; headerRow: number; columns: ImportColumn[]; rows: string[][]; rowNumbers: number[]; dataRowCount: number },
): Promise<void> {
  await client.query(
    `UPDATE import_jobs SET status = 'parsed', sheet = $2, has_header = $3, header_row = $4, columns = $5::jsonb, rows = $6::jsonb, row_numbers = $7, data_row_count = $8, updated_at = now() WHERE id = $1`,
    [id, parsed.sheet, parsed.hasHeader, parsed.headerRow, JSON.stringify(parsed.columns), JSON.stringify(parsed.rows), parsed.rowNumbers, parsed.dataRowCount],
  );
}

/** 매핑·고정값과 전체 행 검증 결과를 저장한다. */
export async function markImportJobPreviewed(client: PoolClient, id: string, mapping: Record<string, ImportTargetField>, fixed: Partial<Record<ImportTargetField, string>>, validation: ImportValidation): Promise<void> {
  await client.query(
    `UPDATE import_jobs SET status = 'previewed', mapping = $2::jsonb, fixed_values = $3::jsonb, validation = $4::jsonb, updated_at = now() WHERE id = $1`,
    [id, JSON.stringify(mapping), JSON.stringify(fixed), JSON.stringify(validation)],
  );
}

/** 실행 시작을 선점한다. previewed에서만 옮기므로 중복 실행은 막힌다. */
export async function claimImportJobExecution(client: PoolClient, id: string): Promise<boolean> {
  const { rowCount } = await client.query(`UPDATE import_jobs SET status = 'executing', updated_at = now() WHERE id = $1 AND status = 'previewed'`, [id]);
  return rowCount === 1;
}

/**
 * 실행 결과를 저장하고 원본(파일 바이트·파싱 그리드)을 지운다.
 * 원본 보관 정책은 처리 후 즉시 파기(명세 6절 확정)다.
 */
export async function markImportJobDone(client: PoolClient, id: string, result: ImportResult): Promise<void> {
  await client.query(
    `UPDATE import_jobs SET status = 'done', result = $2::jsonb, error = NULL, file = NULL, rows = NULL, updated_at = now() WHERE id = $1`,
    [id, JSON.stringify(result)],
  );
}

/** 실행 실패도 처리가 끝난 것이므로 원본은 같이 지운다. */
export async function markImportJobFailed(client: PoolClient, id: string, error: string): Promise<void> {
  await client.query(`UPDATE import_jobs SET status = 'failed', error = $2, file = NULL, rows = NULL, updated_at = now() WHERE id = $1`, [id, error.slice(0, 300)]);
}

// ── 행사·고객사·위키 생성 ────────────────────────────────────────────────────

/** 가져오기로 만드는 행사다. events_insert 정책이 is_internal과 created_by를 검사한다. */
export async function insertEvent(
  client: PoolClient,
  event: { clientId: string; name: string; startDate: string; endDate: string; place: string; status: EventStatus; createdBy: string },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO events (client_id, name, start_date, end_date, place, status, created_by) VALUES ($1, $2, $3::date, $4::date, $5, $6, $7) RETURNING id`,
    [event.clientId, event.name, event.startDate, event.endDate, event.place, event.status, event.createdBy],
  );
  return rows[0]!.id;
}

/** 행사를 만든 사람을 PM 멤버로 둔다. 첫 멤버라 RLS 정책으로는 못 넣어 소유자 권한 함수를 쓴다. */
export async function addEventCreatorAsPm(client: PoolClient, eventId: string, userId: string): Promise<void> {
  await client.query(`SELECT import_add_event_creator($1, $2)`, [eventId, userId]);
}

/** 이름으로 고객사를 찾는다. 없으면 undefined다. */
export async function findClientByName(client: PoolClient, name: string): Promise<{ id: string } | undefined> {
  const { rows } = await client.query<{ id: string }>(`SELECT id FROM clients WHERE name = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1`, [name]);
  return rows[0];
}

/** 가져오기 안에서 고객사를 새로 만든다. clients_insert 정책이 is_internal을 검사한다. */
export async function insertClient(client: PoolClient, name: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(`INSERT INTO clients (name) VALUES ($1) RETURNING id`, [name]);
  return rows[0]!.id;
}

/** 가져온 행사 하나의 처리 이력이다. 행사 단위로 남겨 나중에 추적할 수 있게 한다. */
export async function auditEventImport(client: PoolClient, eventId: string, actorId: string, detail: { sourceRow: number; jobId: string }): Promise<void> {
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'event.import', $3::jsonb)`, [eventId, actorId, JSON.stringify(detail)]);
}
