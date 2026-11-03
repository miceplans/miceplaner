/** 실행 환경 설정. process.env를 읽는 시점에 값을 해석해 테스트에서 globalSetup 이후 서버를 만들 수 있게 한다. */
export const config = {
  get port(): number {
    return Number(process.env.COLLAB_PORT ?? 3300);
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
  /** API가 AI 제안 승인·되돌리기 때 내부 변경 API를 호출할 때 쓰는 공유 비밀. 없으면 내부 API는 꺼진다. */
  get internalSecret(): string {
    return process.env.COLLAB_INTERNAL_SECRET ?? '';
  },
  /** 저장 지연(ms). 편집이 멈춘 뒤 이 시간이 지나거나 maxDebounce에 도달하면 저장한다. */
  get debounce(): number {
    return Number(process.env.COLLAB_DEBOUNCE_MS ?? 1500);
  },
  /** TEI 주소. 있으면 본문이 바뀔 때 임베딩 작업을 큐에 넣는다. 없으면 dense 검색을 쓰지 않는다. */
  get teiUrl(): string {
    return process.env.TEI_URL ?? '';
  },
};
