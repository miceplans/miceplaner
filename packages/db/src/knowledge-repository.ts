import type { PoolClient } from 'pg';
import type { DocVisibility, ProposalKind, ProposalStatus } from '@miceplans/domain';
import { isoTs } from './sql';

export type DocPageRow = { id: string; eventId: string; title: string; visibility: DocVisibility; version: number; bodyMd: string; updatedAt: string };

const PAGE = `id, event_id AS "eventId", title, visibility, version, body_md AS "bodyMd", ${isoTs('updated_at', 'updatedAt')}`;

/** 볼 수 없는 문서는 RLS 때문에 undefined다. */
export async function getDocPage(client: PoolClient, docId: string): Promise<DocPageRow | undefined> {
  const { rows } = await client.query<DocPageRow>(`SELECT ${PAGE} FROM event_docs WHERE id = $1 AND deleted_at IS NULL`, [docId]);
  return rows[0];
}

/** 권한이 없으면 RLS가 거부한다(42501). */
export async function createDocPage(client: PoolClient, doc: { eventId: string; title: string; visibility: DocVisibility; bodyMd: string }): Promise<DocPageRow> {
  const { rows } = await client.query<DocPageRow>(
    `INSERT INTO event_docs (event_id, title, visibility, body_md) VALUES ($1, $2, $3, $4) RETURNING ${PAGE}`,
    [doc.eventId, doc.title, doc.visibility, doc.bodyMd],
  );
  return rows[0]!;
}

/**
 * 제목·본문 저장. 일반 텍스트는 마지막 저장 우선이라 version을 받지 않고, 저장할 때마다 올린다.
 * expectedVersion을 주면 AI 제안 승인처럼 충돌을 검사하고 어긋나면 null이다.
 */
export async function saveDocBody(client: PoolClient, docId: string, patch: { title?: string; bodyMd: string }, expectedVersion?: number): Promise<DocPageRow | null> {
  const vals: unknown[] = [docId, patch.bodyMd, patch.title ?? null];
  let where = 'id = $1 AND deleted_at IS NULL';
  if (expectedVersion !== undefined) {
    vals.push(expectedVersion);
    where += ` AND version = $${vals.length}`;
  }
  const { rows } = await client.query<DocPageRow>(
    `UPDATE event_docs SET body_md = $2, title = coalesce($3, title), version = version + 1, updated_at = now() WHERE ${where} RETURNING ${PAGE}`,
    vals,
  );
  return rows[0] ?? null;
}

export async function softDeleteDocPage(client: PoolClient, actorId: string, docId: string): Promise<boolean> {
  // 삭제 뒤에는 RLS가 문서를 숨기므로 감사 로그에 쓸 event_id를 먼저 읽는다.
  const eventId = (await client.query<{ event_id: string }>('SELECT event_id FROM event_docs WHERE id = $1', [docId])).rows[0]?.event_id;
  const { rows } = await client.query<{ ok: boolean }>('SELECT soft_delete_doc($1) AS ok', [docId]);
  const ok = rows[0]!.ok;
  if (ok) await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, 'doc.delete', $3)`, [eventId, actorId, JSON.stringify({ docId })]);
  return ok;
}

export type ChunkInput = { index: number; heading: string; content: string };

/** 청크를 전부 갈아끼운다. 같은 트랜잭션에서 본문을 저장한 직후 호출한다. */
export async function replaceChunks(client: PoolClient, docId: string, eventId: string, chunks: readonly ChunkInput[]): Promise<void> {
  await client.query('DELETE FROM knowledge_chunks WHERE doc_id = $1', [docId]);
  if (chunks.length === 0) return;
  await client.query(
    `INSERT INTO knowledge_chunks (doc_id, event_id, chunk_index, heading, content)
     SELECT $1, $2, c.idx, c.heading, c.content FROM unnest($3::int[], $4::text[], $5::text[]) AS c(idx, heading, content)`,
    [docId, eventId, chunks.map((c) => c.index), chunks.map((c) => c.heading), chunks.map((c) => c.content)],
  );
}

export type SearchFilter = { eventId?: string; clientId?: string; since?: string; limit: number };
export type ChunkHit = { id: string; docId: string; eventId: string; title: string; heading: string; content: string; updatedAt: string };

const HIT = `c.id, c.doc_id AS "docId", c.event_id AS "eventId", d.title, c.heading, c.content, ${isoTs('d.updated_at', 'updatedAt')}`;

function where(filter: SearchFilter, vals: unknown[]): string {
  const cond = ['d.deleted_at IS NULL', 'e.deleted_at IS NULL'];
  const put = (sql: string, value: unknown) => { vals.push(value); cond.push(sql.replace('?', `$${vals.length}`)); };
  if (filter.eventId) put('d.event_id = ?', filter.eventId);
  if (filter.clientId) put('e.client_id = ?', filter.clientId);
  if (filter.since) put('d.updated_at >= ?::timestamptz', filter.since);
  return cond.join(' AND ');
}

/** 권한 필터(event_docs·knowledge_chunks RLS) 뒤에 FTS로 찾는다. tsquery는 packages/knowledge의 toTsQuery 결과다. */
export async function searchChunksFts(client: PoolClient, tsquery: string, filter: SearchFilter): Promise<ChunkHit[]> {
  if (!tsquery) return [];
  const vals: unknown[] = [tsquery];
  const cond = where(filter, vals);
  vals.push(filter.limit);
  const { rows } = await client.query<ChunkHit>(
    `SELECT ${HIT} FROM knowledge_chunks c JOIN event_docs d ON d.id = c.doc_id JOIN events e ON e.id = d.event_id
     WHERE c.tsv @@ to_tsquery('simple', $1) AND ${cond}
     ORDER BY ts_rank_cd(c.tsv, to_tsquery('simple', $1)) DESC, d.updated_at DESC LIMIT $${vals.length}`,
    vals,
  );
  return rows;
}

/** 어형 변화로 FTS가 놓친 항목을 pg_trgm 단어 유사도로 보완한다. */
export async function searchChunksTrigram(client: PoolClient, text: string, filter: SearchFilter): Promise<ChunkHit[]> {
  if (!text.trim()) return [];
  const vals: unknown[] = [text];
  const cond = where(filter, vals);
  vals.push(filter.limit);
  const { rows } = await client.query<ChunkHit>(
    `SELECT ${HIT} FROM knowledge_chunks c JOIN event_docs d ON d.id = c.doc_id JOIN events e ON e.id = d.event_id
     WHERE $1 <% c.content AND ${cond}
     ORDER BY word_similarity($1, c.content) DESC, d.updated_at DESC LIMIT $${vals.length}`,
    vals,
  );
  return rows;
}

// ── AI 제안 ──────────────────────────────────────────────────────────────

export type ProposalRow = {
  id: string; eventId: string; kind: ProposalKind; summary: string; payload: unknown; status: ProposalStatus;
  createdBy: string; createdAt: string; decidedBy: string | null; decidedAt: string | null;
};
const PROPOSAL = `id, event_id AS "eventId", kind, summary, payload, status, created_by AS "createdBy", ${isoTs('created_at', 'createdAt')},
  decided_by AS "decidedBy", ${isoTs('decided_at', 'decidedAt')}`;

export async function insertProposal(client: PoolClient, actorId: string, p: { eventId: string; kind: ProposalKind; summary: string; payload: unknown }): Promise<ProposalRow> {
  const { rows } = await client.query<ProposalRow>(
    `INSERT INTO ai_proposals (event_id, kind, summary, payload, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING ${PROPOSAL}`,
    [p.eventId, p.kind, p.summary, JSON.stringify(p.payload), actorId],
  );
  return rows[0]!;
}

export async function listProposals(client: PoolClient, eventId: string, status?: ProposalStatus): Promise<ProposalRow[]> {
  const { rows } = await client.query<ProposalRow>(
    `SELECT ${PROPOSAL} FROM ai_proposals WHERE event_id = $1 AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC`,
    [eventId, status ?? null],
  );
  return rows;
}

export async function getProposal(client: PoolClient, id: string): Promise<ProposalRow | undefined> {
  const { rows } = await client.query<ProposalRow>(`SELECT ${PROPOSAL} FROM ai_proposals WHERE id = $1`, [id]);
  return rows[0];
}

/** 결정 대기 중인 제안만 바꾼다. 이미 결정됐거나 권한이 없으면 null이다. 감사 로그를 남긴다. */
export async function decideProposal(client: PoolClient, actorId: string, id: string, status: 'approved' | 'rejected'): Promise<ProposalRow | null> {
  const { rows } = await client.query<ProposalRow>(
    `UPDATE ai_proposals SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1 AND status = 'pending' RETURNING ${PROPOSAL}`,
    [id, status, actorId],
  );
  const row = rows[0];
  if (!row) return null;
  await client.query(`INSERT INTO audit_log (event_id, actor_id, action, detail) VALUES ($1, $2, $3, $4)`, [row.eventId, actorId, `ai.proposal.${status}`, JSON.stringify({ proposalId: id, kind: row.kind })]);
  return row;
}

// ── AI 호출 로그 ─────────────────────────────────────────────────────────

export type AiCallLog = {
  userId: string; eventId: string | null; model: string; messages: unknown; toolCalls: unknown;
  promptTokens: number | null; completionTokens: number | null; latencyMs: number; error: string | null;
};

export async function logAiCall(client: PoolClient, call: AiCallLog): Promise<void> {
  await client.query(
    `INSERT INTO ai_calls (user_id, event_id, model, messages, tool_calls, prompt_tokens, completion_tokens, latency_ms, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [call.userId, call.eventId, call.model, JSON.stringify(call.messages), JSON.stringify(call.toolCalls), call.promptTokens, call.completionTokens, call.latencyMs, call.error],
  );
}
