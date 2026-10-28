import { createParamDecorator, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { DbContext } from '@miceplans/db';

/** JWT 가드가 확인한 요청 주체다. RLS 컨텍스트와 1:1이다. */
export type AuthUser = DbContext & { name: string };

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

/** 낮은 권한 이상의 기능에 쓴다. Client는 낮은 기능에 접근할 수 없다 (명세 2.2). */
export const requireInternal = (user: AuthUser): void => {
  if (user.role === 'client') throw new ForbiddenException('Client는 이 기능에 접근할 수 없다');
};
