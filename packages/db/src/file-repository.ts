import type { PoolClient } from 'pg';
import { isoTs } from './sql';
import type { ChunkHit, SearchFilter } from './knowledge-repository';

export type FileStatus = 'pending' | 'ready' | 'failed';
export type FileRow = { id: string; eventId: string; docId: string | null; itemId: string | null; name: string; mime: string; sizeBytes: number; storageKey: string; status: FileStatus; error: string | null; uploadedBy: string; createdAt: string };

const FILE = `id, event_id AS "eventId", doc_id AS "docId", item_id AS "itemId", name, mime, size_bytes::int AS "sizeBytes", storage_key AS "storageKey", status, error, uploaded_by AS "uploadedBy", ${isoTs('created_at', 'createdAt')}`;

/** 권한이 없으면 RLS가 거부한다(42501). */
export async function insertFile(client: PoolClient, f: { eventId: string; itemId?: string | null; name: string; mime: string; sizeBytes: number; storageKey: string; uploadedBy: string }): Promise<FileRow> {
  const { rows } = await client.query<FileRow>(
    `INSERT INTO event_files (event_id, name, mime, size_bytes, storage_key, uploaded_by, item_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${FILE}`,
    [f.eventId, f.name, f.mime, f.sizeBytes, f.storageKey, f.uploadedBy, f.itemId ?? null],
  );
  return rows[0]!;
}

/** 볼 수 없는 파일은 RLS 때문에 undefined다. */
export async function getFile(client: PoolClient, id: string): Promise<FileRow | undefined> {
  return (await client.query<FileRow>(`SELECT ${FILE} FROM event_files WHERE id = $1 AND deleted_at IS NULL`, [id])).rows[0];
}

export async function listFiles(client: PoolClient, eventId: string, filter: { itemId?: string } = {}): Promise<FileRow[]> {
  const cond = ['event_id = $1'];
  const vals: unknown[] = [eventId];
  if (filter.itemId) { vals.push(filter.itemId); cond.push(`item_id = $${vals.length}`); }
  return (await client.query<FileRow>(`SELECT ${FILE} FROM event_files WHERE ${cond.join(' AND ')} AND deleted_at IS NULL ORDER BY created_at DESC`, vals)).rows;
}

/** 첨부 대상 항목을 옮긴다. 같은 행사의 항목이어야 하고 대상이 없으면 undefined다 (RLS·트리거). */
export async function moveFile(client: PoolClient, id: string, itemId: string | null): Promise<FileRow | undefined> {
  return (await client.query<FileRow>(`UPDATE event_files SET item_id = $2 WHERE id = $1 RETURNING ${FILE}`, [id, itemId])).rows[0];
}

export async function markFile(client: PoolClient, id: string, patch: { status: FileStatus; error?: string | null; docId?: string }): Promise<void> {
  await client.query(`UPDATE event_files SET status = $2, error = $3, doc_id = coalesce($4, doc_id) WHERE id = $1`, [id, patch.status, patch.error ?? null, patch.docId ?? null]);
}

/** 변환 문서와 색인까지 함께 내린다. S3 원본은 보존 정책이 정해질 때까지 남긴다. */
export async function softDeleteFile(client: PoolClient, actorId: string, id: string): Promise<boolean> {
  const eventId = (await client.query<{ event_id: string }>('SELECT event_id FROM event_files WHERE id = $1', [id])).rows[0]?.event_id;
  const ok = (await client.query<{ ok: boolean }>('SELECT soft_delete_file($1) AS ok', [id])).rows[0]!.ok;
  if (ok) await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'file.delete', $3)`, [eventId, actorId, JSON.stringify({ fileId: id })]);
  return ok;
}

// ── dense 검색 ───────────────────────────────────────────────────────────

/** pgvector가 설치된 서버에서만 true다. 아니면 검색은 lexical만 쓴다. */
let vectorKnown = false;

/** 컬럼은 마이그레이션 뒤에 사라지지 않으므로 있다는 결과만 프로세스 안에서 기억해 검색마다 카탈로그를 조회하지 않는다. */
export async function hasVector(client: PoolClient): Promise<boolean> {
  if (vectorKnown) return true;
  const { rows } = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'`);
  vectorKnown = rows.length > 0;
  return vectorKnown;
}

export type PendingChunk = { id: string; heading: string; content: string };

/** 문서의 아직 임베딩되지 않은 청크. */
export async function chunksMissingEmbedding(client: PoolClient, docId: string): Promise<PendingChunk[]> {
  return (await client.query<PendingChunk>(`SELECT id, heading, content FROM knowledge_chunks WHERE doc_id = $1 AND embedding IS NULL ORDER BY chunk_index`, [docId])).rows;
}

/** 임베딩을 저장한다. 그 사이 본문이 바뀌어 청크가 사라졌다면 조용히 건너뛴다. 저장한 개수를 돌려준다. */
export async function setChunkEmbeddings(client: PoolClient, ids: readonly string[], vectors: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { rowCount } = await client.query(
    `UPDATE knowledge_chunks c SET embedding = v.vec::vector FROM unnest($1::uuid[], $2::text[]) AS v(id, vec) WHERE c.id = v.id`,
    [ids, vectors],
  );
  return rowCount ?? 0;
}

/** 권한 필터(RLS) 뒤에 코사인 거리가 가까운 청크를 찾는다. 임베딩이 없는 청크는 제외되고, maxDistance보다 먼 청크는 관련 없는 것으로 본다. */
export async function searchChunksDense(client: PoolClient, vector: string, filter: SearchFilter, maxDistance?: number): Promise<ChunkHit[]> {
  const vals: unknown[] = [vector];
  const cond = ['d.deleted_at IS NULL', 'e.deleted_at IS NULL', 'c.embedding IS NOT NULL'];
  const put = (sql: string, value: unknown) => { vals.push(value); cond.push(sql.replace('?', `$${vals.length}`)); };
  if (filter.eventId) put('d.event_id = ?', filter.eventId);
  if (filter.clientId) put('e.client_id = ?', filter.clientId);
  if (filter.since) put('d.updated_at >= ?::timestamptz', filter.since);
  if (maxDistance !== undefined) put('c.embedding <=> $1::vector <= ?', maxDistance);
  vals.push(filter.limit);
  return (await client.query<ChunkHit>(
    `SELECT c.id, c.doc_id AS "docId", c.event_id AS "eventId", d.title, c.heading, c.content, ${isoTs('d.updated_at', 'updatedAt')}
     FROM knowledge_chunks c JOIN event_docs d ON d.id = c.doc_id JOIN events e ON e.id = d.event_id
     WHERE ${cond.join(' AND ')} ORDER BY c.embedding <=> $1::vector LIMIT $${vals.length}`,
    vals,
  )).rows;
}
