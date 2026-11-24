import { createPool } from '@miceplans/db';
import { openProducer, runWorker } from '@miceplans/queue';
import { teiEmbedder } from '@miceplans/knowledge/embed';
import { storeFromEnv } from '@miceplans/storage';
import { config } from './config';
import { embedDocHandler, parseFileHandler } from './handlers';

/** 문서 임베딩은 32개 배치라 CPU TEI에서 수 초가 걸릴 수 있다. 멈춘 요청만 끊고 pg-boss가 다시 시도한다. */
const EMBED_TIMEOUT_MS = 60_000;

const store = storeFromEnv();
if (!store) throw new Error('S3_BUCKET 또는 FILES_DIR이 필요하다 (업로드 원본 저장소)');

const pool = createPool(config.databaseUrl);
const producer = await openProducer(config.databaseUrl);
const deps = { pool, store, embedder: config.teiUrl ? teiEmbedder(config.teiUrl, { apiKey: config.teiApiKey, timeoutMs: EMBED_TIMEOUT_MS }) : null, enqueueEmbed: producer.enqueueEmbedDoc };
const worker = await runWorker(config.databaseUrl, { parseFile: parseFileHandler(deps), embedDoc: embedDocHandler(deps) });
console.log(`worker 시작 (임베딩 ${deps.embedder ? '켜짐' : '꺼짐'})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void worker.stop().then(() => producer.stop()).then(() => pool.end()).then(() => process.exit(0));
  });
}
