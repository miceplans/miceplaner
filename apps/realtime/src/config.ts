/** 실행 환경 설정. process.env를 읽는 시점에 값을 해석해 테스트에서 globalSetup 이후 서버를 만들 수 있게 한다. */
export const config = {
  get port(): number {
    return Number(process.env.REALTIME_PORT ?? 3400);
  },
  get databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL이 필요하다 (miceplans_app 역할의 접속 문자열)');
    return url;
  },
  /** API와 같은 세션 토큰(HS256)을 검증한다. */
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET이 필요하다 (운영 환경에서는 기본값을 쓸 수 없다)');
    return 'dev-only-insecure-secret-change-me';
  },
  get workspaceId(): string {
    return process.env.WORKSPACE_ID ?? 'miceplans';
  },
  /** 내부 웹의 허용 출처(쉼표 구분). Client 포털 출처는 허용하지 않는다. 운영에서 비우면 CORS를 열지 않는다. */
  get webOrigin(): string {
    return process.env.WEB_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3100,http://127.0.0.1:3100');
  },
  /** API가 내부 푸시를 보낼 때 쓰는 공유 비밀. 없으면 내부 푸시는 꺼진다(403). */
  get internalSecret(): string {
    return process.env.REALTIME_INTERNAL_SECRET ?? '';
  },
};
