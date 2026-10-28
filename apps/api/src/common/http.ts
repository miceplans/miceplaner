import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

/** pg 오류를 HTTP 응답으로 바꾼다. DB 트리거가 한국어로 던진 메시지를 그대로 돌려준다. */
export const mapDbError = (error: unknown): never => {
  const { code, message } = error as { code?: string; message?: string };
  if (code === '42501') throw new ForbiddenException(message ?? '권한이 없다');
  if (code === '23505' || code === '23514' || code === 'P0001') throw new ConflictException(message ?? '요청이 현재 상태와 맞지 않는다');
  if (code === '23503' || code === '23502') throw new BadRequestException(message ?? '요청이 올바르지 않다');
  throw error;
};

/** 낙관적 잠금 충돌 응답 (contracts의 versionConflict 형태). */
export const versionConflictError = (currentVersion: number) =>
  new ConflictException({ code: 'VERSION_CONFLICT', currentVersion } as const);

/** null·undefined이면 404다. 값이 있으면 그대로 돌려준다. */
export function assertFound<T>(value: T | undefined | null, what = '대상'): T {
  if (value === undefined || value === null) throw new NotFoundException(`${what}을 찾을 수 없다`);
  return value;
}

/** false면 404다. */
export function assertOk(ok: boolean, what = '대상'): void {
  if (!ok) throw new NotFoundException(`${what}을 찾을 수 없다`);
}
