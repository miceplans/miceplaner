import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, Logger, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hitRateLimit, withContext, type Pool } from '@miceplans/db';
import { config } from '../config';
import { DB_POOL } from '../tokens';

export const RATE_LIMIT_KEY = 'rateLimit';

/** 공개 엔드포인트의 요청 제한 규칙. IP는 항상, 이메일은 본문에 있을 때 함께 센다. */
export type RateLimitRule = { scope: string; ipPerWindow: number; emailPerWindow?: number; windowSeconds: number };

export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);

type RequestLike = { headers: Record<string, string | string[] | undefined>; ip?: string; body?: unknown };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();

/**
 * 클라이언트 IP. Vercel 엣지가 덮어쓰는 `x-vercel-forwarded-for`·`x-real-ip`를 우선한다.
 * 엣지 헤더가 없는 로컬·테스트에서는 소켓 주소를 쓴다. 클라이언트가 보낼 수 있는 `x-forwarded-for`는 믿지 않는다.
 */
export const clientIp = (req: RequestLike): string =>
  first(req.headers['x-vercel-forwarded-for']) ?? first(req.headers['x-real-ip']) ?? req.ip ?? 'unknown';

const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32);

/** 카운터 키. 값(IP·이메일·사용자 ID)은 해시로만 남겨 원문을 저장하지 않는다. */
export const rateLimitKey = (scope: string, kind: 'ip' | 'email' | 'user', value: string) => `${scope}:${kind}:${digest(value)}`;

/**
 * 비밀번호 해싱(scrypt)·하이웍스 조회 전에 IP와 이메일 기준으로 요청 수를 제한한다 (계정 대입, API 소진, 비용형 DoS 방어).
 * 카운터는 PostgreSQL에 두어 서버리스 인스턴스 사이에서 공유한다. 이메일·IP 원문은 저장하지 않는다.
 * DB 오류로 카운터를 못 올리면 로그인 자체가 막히지 않도록 통과시키되 경고를 남긴다(어차피 같은 DB가 막히면 로그인도 실패한다).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.get<RateLimitRule | undefined>(RATE_LIMIT_KEY, context.getHandler());
    if (!rule || !config.rateLimitEnabled) return true;
    const req = context.switchToHttp().getRequest<RequestLike>();
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    const checks: Array<[string, number]> = [[rateLimitKey(rule.scope, 'ip', clientIp(req)), rule.ipPerWindow]];
    if (email && rule.emailPerWindow) checks.push([rateLimitKey(rule.scope, 'email', email), rule.emailPerWindow]);

    try {
      // 로그인 전이라 신원이 없다. 최소 권한(client) 익명 컨텍스트로 카운터 함수만 실행한다.
      const results = await withContext(this.pool, { workspaceId: config.workspaceId, userId: '', role: 'client' }, async (db) => {
        const out: boolean[] = [];
        for (const [key, limit] of checks) out.push(await hitRateLimit(db, key, rule.windowSeconds, limit));
        return out;
      });
      if (results.some((allowed) => !allowed)) {
        throw new HttpException({ statusCode: 429, message: '[429] 요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }, HttpStatus.TOO_MANY_REQUESTS, {});
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn(`요청 제한 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
    return true;
  }
}
