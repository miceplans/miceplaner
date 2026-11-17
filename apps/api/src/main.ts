import 'reflect-metadata';
import { config } from './config';
import { createApiApp } from './server';

async function bootstrap() {
  const app = await createApiApp();
  await app.listen(config.port);
  console.log(`MICEPLANNER API listening on :${config.port} (docs: /docs)`);
}

void bootstrap();
