import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ZodType } from 'zod';

/** contracts의 Zod 스키마로 요청 부분을 검증해 핸들러에 넘긴다 (AGENTS.md: HTTP DTO는 contracts에서 정의). */
const parse = (schema: ZodType, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? '요청이 올바르지 않다');
  return result.data;
};

// 스키마를 객체로 감싸 전달한다. zod 스키마는 transform 메서드를 갖고 있어 createParamDecorator가
// 데이터를 파이프로 오인해 버리는 것을 막는다.
type Holder = { schema: ZodType };

const zodBody = createParamDecorator(({ schema }: Holder, ctx: ExecutionContext) => parse(schema, ctx.switchToHttp().getRequest().body));
const zodQuery = createParamDecorator(({ schema }: Holder, ctx: ExecutionContext) => parse(schema, ctx.switchToHttp().getRequest().query));

export const ZodBody = (schema: ZodType) => zodBody({ schema });
export const ZodQuery = (schema: ZodType) => zodQuery({ schema });
