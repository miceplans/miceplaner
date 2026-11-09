import type { IncomingMessage, ServerResponse } from 'node:http';
import 'reflect-metadata';
import { createApiApp } from '../src/server';

let appPromise: ReturnType<typeof createApiApp> | undefined;

/** Vercel Node Function 진입점. warm 인스턴스에서는 Nest와 DB pool을 다시 만들지 않는다. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= createApiApp();
  const app = await appPromise;
  if (req.url === '/api') req.url = '/';
  else if (req.url?.startsWith('/api/')) req.url = req.url.slice(4) || '/';
  return app.getHttpAdapter().getInstance()(req, res);
}
