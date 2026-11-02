import { createPool } from '@miceplans/db';
import { openProducer, type Producer } from '@miceplans/queue';
import { config } from './config';
import { createCollabServer } from './server';

const pool = createPool(config.databaseUrl);
// 임베딩이 켜져 있을 때만 작업 큐를 쓴다. 처음 필요할 때 연결해 큐 장애가 협업 시작을 막지 않게 한다.
let producer: Promise<Producer> | undefined;
const onBodyChanged = config.teiUrl
  ? async (docId: string, user: { workspaceId: string; userId: string; role: Parameters<Producer['enqueueEmbedDoc']>[0]['ctx']['role'] }) => {
      producer ??= openProducer(config.databaseUrl).catch((error) => { producer = undefined; throw error; });
      await (await producer).enqueueEmbedDoc({ docId, ctx: { workspaceId: user.workspaceId, userId: user.userId, role: user.role } });
    }
  : undefined;
const server = createCollabServer(pool, { onBodyChanged });
await server.listen();
console.log(`MICEPLANS collaboration listening on :${config.port}`);

const shutdown = async () => {
  await server.destroy();
  if (producer) await (await producer.catch(() => undefined))?.stop();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
