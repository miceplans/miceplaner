import { z } from 'zod';

export const uuid = z.uuid();
/** 달력 날짜 YYYY-MM-DD. 시간대 변환을 하지 않는다. */
export const isoDate = z.iso.date();
export const isoDateTime = z.iso.datetime({ offset: true });

/** 담당자·마감일·공개 상태처럼 버전 충돌을 검사하는 변경에 쓴다 (명세 3.2). */
export const expectedVersion = z.number().int().positive();

export const idParam = z.object({ id: uuid });

/** 낙관적 잠금 충돌 응답. 서버는 409로 돌려주고 사용자에게 안내한다. */
export const versionConflict = z.object({ code: z.literal('VERSION_CONFLICT'), currentVersion: z.number().int().positive() });
