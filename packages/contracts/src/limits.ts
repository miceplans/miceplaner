/**
 * 업로드 파일 하나의 크기 상한(바이트). API는 이 값을 넘는 요청을 413으로 거부하고, 웹은 보내기 전에 같은 값으로 막는다.
 * Vercel 함수의 요청·응답 본문 상한(4.5MB)에 multipart 오버헤드 여유를 둔 값이다 (ADR 0001, 명세 F-10).
 * zod 등 런타임 의존성이 없어 웹 번들에서도 가볍게 가져다 쓴다.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** 사용자 안내 문구에 쓰는 MB 단위 상한. */
export const MAX_FILE_MB = MAX_FILE_BYTES / 1024 / 1024;

/** 상한 초과 안내 문구. API의 413 응답과 웹의 사전 검사가 같은 문구를 쓴다. */
export const FILE_TOO_LARGE_MESSAGE = `[413] 파일은 ${MAX_FILE_MB}MB를 넘을 수 없습니다.`;
