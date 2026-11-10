import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import type { ZodType } from 'zod';
import { schemaOf } from './openapi';

/** contracts의 Zod 스키마로 요청 부분을 검증해 핸들러에 넘긴다 (AGENTS.md: HTTP DTO는 contracts에서 정의). */
const parse = (schema: ZodType, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? '[400] 요청이 올바르지 않습니다.');
  return result.data;
};

// 스키마를 객체로 감싸 전달한다. zod 스키마는 transform 메서드를 갖고 있어 createParamDecorator가
// 데이터를 파이프로 오인해 버리는 것을 막는다.
type Holder = { schema: ZodType };

const zodBody = createParamDecorator(({ schema }: Holder, ctx: ExecutionContext) => parse(schema, ctx.switchToHttp().getRequest().body));
const zodQuery = createParamDecorator(({ schema }: Holder, ctx: ExecutionContext) => parse(schema, ctx.switchToHttp().getRequest().query));

/**
 * multer가 처리한 multipart 필드용 검증기다.
 *
 * Vercel Node 호환 런타임의 request.body는 지연 getter다. multipart 요청에서 이
 * getter를 다시 읽으면 런타임이 Content-Type을 재해석하다가 실패할 수 있다.
 * multer가 직접 설정한 own data property만 읽어 파일 인터셉터의 결과를 검증한다.
 */
const zodMultipartFields = createParamDecorator(({ schema }: Holder, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest() as object;
  const body = Object.getOwnPropertyDescriptor(request, 'body');
  return parse(schema, body && 'value' in body ? body.value : {});
});

/** 파라미터 데코레이터가 같은 메서드에 문서용 메타데이터(ApiBody·ApiQuery)도 단다. 컨트롤러마다 따로 쓰지 않아도 OpenAPI에 요청 스키마가 오른다. */
const documented = (param: ParameterDecorator, doc: (descriptor: PropertyDescriptor) => MethodDecorator[]): ParameterDecorator => (target, key, index) => {
  param(target, key, index);
  if (key === undefined) return;
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor) for (const decorate of doc(descriptor)) decorate(target, key, descriptor);
};

/** document: false는 컨트롤러가 @ApiBody를 직접 달 때(multipart처럼 계약 스키마가 본문 전체가 아닐 때) 쓴다. */
export const ZodBody = (schema: ZodType, { document = true }: { document?: boolean } = {}) =>
  documented(zodBody({ schema }), () => (document ? [ApiBody({ schema: schemaOf(schema) })] : []));

/** multer가 파싱한 multipart 텍스트 필드를 contracts 스키마로 검증한다. */
export const ZodMultipartFields = (schema: ZodType) =>
  documented(zodMultipartFields({ schema }), () => []);

export const ZodQuery = (schema: ZodType) =>
  documented(zodQuery({ schema }), () => {
    const json = schemaOf(schema);
    const resolved = json.$ref ? undefined : json;
    const props = (resolved?.properties ?? {}) as Record<string, object>;
    const required = new Set(resolved?.required ?? []);
    return Object.entries(props).map(([name, property]) => ApiQuery({ name, required: required.has(name), schema: property as never }));
  });
