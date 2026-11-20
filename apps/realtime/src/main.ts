import { createPool } from '@miceplans/db';
import { config } from './config';
import { createRealtimeServer } from './server';

const pool = createPool(config.databaseUrl);
const server = createRealtimeServer(pool);
await server.listen();
console.log(`MICEPLANNER realtime listening on :${config.port}`);

const shutdown = async () => {
  await server.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
