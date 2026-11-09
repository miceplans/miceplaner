import type { IncomingMessage, ServerResponse } from 'node:http';
import 'reflect-metadata';
import { createApiApp } from '../src/server';

let appPromise: ReturnType<typeof createApiApp> | undefined;

/** tsup으로 단일 파일화되는 Vercel 함수 본문. warm 인스턴스에서는 Nest와 DB pool을 재사용한다. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= createApiApp();
  const app = await appPromise;
  if (req.url === '/api') req.url = '/';
  else if (req.url?.startsWith('/api/')) req.url = req.url.slice(4) || '/';
  return app.getHttpAdapter().getInstance()(req, res);
}
