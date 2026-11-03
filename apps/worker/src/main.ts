import { createPool } from '@miceplans/db';
import { openProducer, runWorker } from '@miceplans/queue';
import { teiEmbedder } from '@miceplans/knowledge/embed';
import { storeFromEnv } from '@miceplans/storage';
import { config } from './config';
import { embedDocHandler, parseFileHandler } from './handlers';

const store = storeFromEnv();
if (!store) throw new Error('S3_BUCKET 또는 FILES_DIR이 필요하다 (업로드 원본 저장소)');

const pool = createPool(config.databaseUrl);
const producer = await openProducer(config.databaseUrl);
const deps = { pool, store, embedder: config.teiUrl ? teiEmbedder(config.teiUrl) : null, enqueueEmbed: producer.enqueueEmbedDoc };
const worker = await runWorker(config.databaseUrl, { parseFile: parseFileHandler(deps), embedDoc: embedDocHandler(deps) });
console.log(`worker 시작 (임베딩 ${deps.embedder ? '켜짐' : '꺼짐'})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void worker.stop().then(() => producer.stop()).then(() => pool.end()).then(() => process.exit(0));
  });
}
