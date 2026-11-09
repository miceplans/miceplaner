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

export const ZodQuery = (schema: ZodType) =>
  documented(zodQuery({ schema }), () => {
    const json = schemaOf(schema);
    const resolved = json.$ref ? undefined : json;
    const props = (resolved?.properties ?? {}) as Record<string, object>;
    const required = new Set(resolved?.required ?? []);
    return Object.entries(props).map(([name, property]) => ApiQuery({ name, required: required.has(name), schema: property as never }));
  });
