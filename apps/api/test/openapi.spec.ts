import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApiDocument, createApiApp } from '../src/server';

type Operation = { operationId?: string; parameters?: { name: string; in: string }[]; requestBody?: unknown; responses: Record<string, { content?: unknown }> };

/** 웹 클라이언트(orval)의 입력이므로 문서가 비거나 어긋나면 생성된 훅의 타입이 깨진다. */
describe('OpenAPI 문서', () => {
  let app: Awaited<ReturnType<typeof createApiApp>>;
  let doc: ReturnType<typeof buildOpenApiDocument>;
  const operations = () =>
    Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, Operation>).map(([method, op]) => ({ path, method, op })),
    );

  beforeAll(async () => {
    app = await createApiApp();
    doc = buildOpenApiDocument(app);
  });
  afterAll(() => app.close());

  it('operationId가 모두 있고 서로 겹치지 않는다', () => {
    const ids = operations().map((o) => o.op.operationId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('경로의 {이름}은 모두 path 파라미터로 선언된다', () => {
    for (const { path, method, op } of operations()) {
      for (const [, name] of path.matchAll(/\{(\w+)\}/g)) {
        expect(op.parameters?.some((p) => p.in === 'path' && p.name === name), `${method} ${path} ${name}`).toBe(true);
      }
    }
  });

  it('본문이 없는 응답은 의도한 것(204·삭제·SSE·헬스)뿐이다', () => {
    const allowed = new Set(['healthHealth', 'authChangePassword', 'aiChat']);
    for (const { path, method, op } of operations()) {
      const hasBody = Object.entries(op.responses).some(([status, r]) => status.startsWith('2') && r.content);
      if (!hasBody) expect(allowed.has(op.operationId!) || method === 'delete' || method === 'put', `${method} ${path}`).toBe(true);
    }
  });

  it('커밋된 openapi.json이 현재 컨트롤러·계약과 같다 (pnpm api:spec으로 갱신)', () => {
    const committed = JSON.parse(readFileSync(fileURLToPath(new URL('../openapi.json', import.meta.url)), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(doc)));
  });
});
