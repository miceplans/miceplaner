import { docsMissingEmbedding, getUserById, hasVector, withContext, type DbContext, type Pool } from '@miceplans/db';
import type { Embedder } from '@miceplans/knowledge/embed';
import { embedDocHandler } from './handlers';

export type BackfillResult = { docs: number; failed: string[] };

/**
 * 임베딩이 빈 청크를 문서 단위로 채운다. TEI를 처음 켰거나 장애로 빠진 문서를 메운다.
 * 모든 문서를 봐야 하므로 재직 중인 Super Admin의 RLS 컨텍스트로만 실행한다(BYPASSRLS 없이).
 */
export async function backfillEmbeddings(deps: { pool: Pool; embedder: Embedder }, ctx: DbContext, log: (line: string) => void = () => {}): Promise<BackfillResult> {
  if (ctx.role !== 'super_admin') throw new Error('백필은 Super Admin 컨텍스트로만 실행한다');
  const docIds = await withContext(deps.pool, ctx, async (db) => {
    const user = await getUserById(db, ctx.userId);
    if (user?.role !== 'super_admin' || user.employmentStatus !== 'active') throw new Error(`재직 중인 Super Admin이 아니다: ${ctx.userId}`);
    if (!(await hasVector(db))) throw new Error('pgvector(embedding 열)가 없는 DB다');
    return docsMissingEmbedding(db);
  });
  const embed = embedDocHandler(deps);
  const failed: string[] = [];
  for (const [i, docId] of docIds.entries()) {
    try {
      await embed({ docId, ctx });
      log(`[${i + 1}/${docIds.length}] ${docId}`);
    } catch (error) {
      failed.push(docId);
      log(`[${i + 1}/${docIds.length}] ${docId} 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { docs: docIds.length, failed };
}
