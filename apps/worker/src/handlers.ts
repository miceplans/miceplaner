import type { EmbedDocJob, ParseFileJob } from '@miceplans/contracts';
import { chunksMissingEmbedding, createDocPage, getFile, hasVector, markFile, reindexDocPage, saveDocBody, setChunkEmbeddings, withContext, type Pool } from '@miceplans/db';
import type { Embedder } from '@miceplans/knowledge/embed';
import { toVectorLiteral } from '@miceplans/knowledge/embed';
import { parseFile, UnsupportedFileError } from '@miceplans/knowledge/parse';
import type { ObjectStore } from '@miceplans/storage';

export type Deps = {
  pool: Pool;
  store: ObjectStore;
  /** 없으면 임베딩을 만들지 않는다. */
  embedder: Embedder | null;
  /** 파싱이 끝난 문서의 임베딩 작업을 넣는다. 임베딩이 꺼져 있으면 호출하지 않는다. */
  enqueueEmbed: (job: EmbedDocJob) => Promise<void>;
};

/** 사용자에게 보이는 실패 사유는 짧게 자른다. */
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

/**
 * 원본을 읽어 Markdown으로 바꾸고 변환 문서·색인·상태를 한 트랜잭션에서 기록한다.
 * 작업 입력의 주체(업로더) 권한으로 실행하므로 그 사이 권한을 잃었다면 파일이 보이지 않아 건너뛴다.
 */
export function parseFileHandler(deps: Deps) {
  return async ({ fileId, ctx }: ParseFileJob, { final }: { final: boolean }): Promise<void> => {
    const file = await withContext(deps.pool, ctx, (db) => getFile(db, fileId));
    if (!file || file.status === 'ready') return; // 삭제됐거나 이미 처리됨 (재시도 안전)
    const fail = (message: string) => withContext(deps.pool, ctx, (db) => markFile(db, fileId, { status: 'failed', error: message }));
    try {
      const bytes = await deps.store.get(file.storageKey);
      if (!bytes) throw new UnsupportedFileError('저장소에 원본이 없다');
      const { markdown } = await parseFile({ name: file.name, mime: file.mime, bytes });
      const docId = await withContext(deps.pool, ctx, async (db) => {
        const page = file.docId
          ? await saveDocBody(db, file.docId, { bodyMd: markdown })
          : await createDocPage(db, { eventId: file.eventId, title: file.name, visibility: 'members', bodyMd: markdown });
        if (!page) throw new UnsupportedFileError('변환 문서를 저장할 수 없다');
        await reindexDocPage(db, page);
        await markFile(db, fileId, { status: 'ready', docId: page.id });
        return page.id;
      });
      if (deps.embedder) await deps.enqueueEmbed({ docId, ctx });
    } catch (error) {
      if (error instanceof UnsupportedFileError) return fail(error.message); // 다시 해도 같은 결과라 재시도하지 않는다
      if (final) return fail(`변환에 실패했다: ${reason(error)}`);
      throw error;
    }
  };
}

/** 문서에서 임베딩이 비어 있는 청크만 채운다. 본문이 다시 색인되면 청크가 새로 생겨 다음 작업이 다시 채운다. */
export function embedDocHandler(deps: Deps) {
  return async ({ docId, ctx }: EmbedDocJob): Promise<void> => {
    if (!deps.embedder) return;
    const pending = await withContext(deps.pool, ctx, async (db) => ((await hasVector(db)) ? chunksMissingEmbedding(db, docId) : []));
    if (pending.length === 0) return;
    const vectors = await deps.embedder(pending.map((c) => `${c.heading}\n${c.content}`.trim()));
    await withContext(deps.pool, ctx, (db) => setChunkEmbeddings(db, pending.map((c) => c.id), vectors.map(toVectorLiteral)));
  };
}
