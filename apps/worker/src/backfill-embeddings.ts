import { createPool } from '@miceplans/db';
import { teiEmbedder } from '@miceplans/knowledge/embed';
import { backfillEmbeddings } from './backfill';
import { config, EMBED_BATCH, EMBED_TIMEOUT_MS } from './config';

// 사용(운영 EC2): docker compose -f /opt/miceplans/compose.yml exec worker node_modules/.bin/tsx src/backfill-embeddings.ts <Super Admin userId>
const userId = process.argv[2];
if (!userId) {
  console.error('사용: backfill-embeddings <Super Admin userId>');
  process.exit(2);
}
if (!config.teiUrl) {
  console.error('TEI_URL이 없다');
  process.exit(2);
}

const pool = createPool(config.databaseUrl);
try {
  const embedder = teiEmbedder(config.teiUrl, { apiKey: config.teiApiKey, timeoutMs: EMBED_TIMEOUT_MS, batchSize: EMBED_BATCH });
  const result = await backfillEmbeddings({ pool, embedder }, { workspaceId: config.workspaceId, userId, role: 'super_admin' }, (line) => console.log(line));
  console.log(`완료: 문서 ${result.docs}개, 실패 ${result.failed.length}개`);
  process.exitCode = result.failed.length ? 1 : 0;
} finally {
  await pool.end();
}
