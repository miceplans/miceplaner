import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, type SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import { API_SCHEMAS } from './common/openapi';
import { AppModule } from './app.module';
import { config } from './config';

/** 컨트롤러 메타데이터와 계약(Zod)에서 OpenAPI 문서를 만든다. 웹 클라이언트 생성(orval)에도 쓴다. */
export function buildOpenApiDocument(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('MICEPLANS API').setDescription('행사 운영 업무 API').setVersion('0.1.0').build(), {
    // operationId가 곧 웹 훅 이름이 된다: EventsController.list → eventsList. 직접 지정한 operationId가 있으면 그것을 쓴다.
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '').replace(/^./, (c) => c.toLowerCase())}${methodKey.replace(/^./, (c) => c.toUpperCase())}`,
  });
  const schemas = Object.fromEntries(Object.entries(API_SCHEMAS).map(([name, schema]) => [name, z.toJSONSchema(schema, { target: 'openapi-3.0' })])) as Record<string, SchemaObject>;
  document.components = { ...document.components, schemas: { ...document.components?.schemas, ...schemas } };
  // 런타임(tsx·vitest)마다 @Param 타입 메타데이터가 달라 path 파라미터가 빠지거나 다르게 나온다. 경로의 {이름}으로 항상 같게 다시 만든다.
  for (const [path, item] of Object.entries(document.paths)) {
    const names = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
    for (const op of Object.values(item) as { parameters?: { name: string; in: string }[] }[]) {
      if (typeof op !== 'object' || !op || !Array.isArray(op.parameters)) continue;
      op.parameters = [
        ...names.map((name) => ({ name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } })),
        ...op.parameters.filter((p) => p.in !== 'path'),
      ] as never;
    }
  }
  return document;
}

/** 로컬 HTTP 서버와 Vercel 함수가 같은 Nest 애플리케이션을 사용한다. */
export async function createApiApp() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('');
  if (config.webOrigin) app.enableCors({ origin: config.webOrigin.split(','), credentials: true });
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
  await app.init();
  return app;
}
