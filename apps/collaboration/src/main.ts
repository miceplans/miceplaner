import { createPool } from '@miceplans/db';
import { config } from './config';
import { createCollabServer } from './server';

const pool = createPool(config.databaseUrl);
const server = createCollabServer(pool);
await server.listen();
console.log(`MICEPLANS collaboration listening on :${config.port}`);

const shutdown = async () => {
  await server.destroy();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
