import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getUserById, withContext } from '@miceplans/db';
import { isRole } from '@miceplans/domain';
import type { Pool } from '@miceplans/db';
import { config } from '../config';
import { DB_POOL } from '../tokens';
import { verifySession } from './jwt';
import { IS_PUBLIC_KEY } from './public.decorator';

/** 모든 요청에서 JWT를 검증하고 DB의 현재 사용자·역할로 컨텍스트를 만든다 (명세 F-01). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedException();

    let payload;
    try {
      payload = await verifySession(token);
    } catch {
      throw new UnauthorizedException('세션이 유효하지 않다');
    }
    const userId = payload.sub;
    const role = typeof payload.role === 'string' && isRole(payload.role) ? payload.role : undefined;
    if (!userId || !role) throw new UnauthorizedException('세션이 유효하지 않다');

    // 매 요청 사용자 행을 확인해 삭제되거나 권한이 바뀐 세션을 즉시 무효화한다.
    const user = await withContext(this.pool, { workspaceId: config.workspaceId, userId, role }, (db) => getUserById(db, userId)).catch(
      () => undefined,
    );
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없다');

    req.user = { workspaceId: config.workspaceId, userId: user.id, role: user.role, name: user.name };
    return true;
  }
}
