/**
 * OpenAPI 문서를 apps/api/openapi.json으로 내보낸다. 웹의 orval이 이 파일에서 클라이언트와 TanStack Query 훅을 만든다.
 * 문서만 만들므로 DB에 연결하지 않는다(Pool은 첫 쿼리 때 연결). 컨트롤러·계약을 바꾸면 `pnpm api:spec`을 다시 실행한다.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL ??= 'postgres://openapi:openapi@127.0.0.1:1/openapi';
process.env.JWT_SECRET ??= 'openapi-export-only';

const { buildOpenApiDocument, createApiApp } = await import('../src/server');
const app = await createApiApp();
writeFileSync(fileURLToPath(new URL('../openapi.json', import.meta.url)), `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
await app.close();
console.log('openapi.json 생성');
