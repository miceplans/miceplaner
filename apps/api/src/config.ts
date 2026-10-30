/** 실행 환경 설정. process.env를 읽는 시점에 값을 해석해 테스트에서 globalSetup 이후 모듈을 만들 수 있게 한다. */
export const config = {
  get port(): number {
    return Number(process.env.PORT ?? 3200);
  },
  get databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL이 필요하다 (miceplans_app 역할의 접속 문자열)');
    return url;
  },
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET이 필요하다 (운영 환경에서는 기본값을 쓸 수 없다)');
    return 'dev-only-insecure-secret-change-me';
  },
  get googleClientId(): string {
    return process.env.GOOGLE_CLIENT_ID ?? '';
  },
  /** 설정하면 이 Google Workspace 도메인(hd) 사용자만 로그인할 수 있다. */
  get googleWorkspaceDomain(): string {
    return process.env.GOOGLE_WORKSPACE_DOMAIN ?? '';
  },
  get workspaceId(): string {
    return process.env.WORKSPACE_ID ?? 'miceplans';
  },
  /** Socket.IO와 Swagger UI의 허용 출처. 비우면 CORS를 열지 않는다. */
  get webOrigin(): string {
    return process.env.WEB_ORIGIN ?? '';
  },
  /** OpenAI 호환 LLM 엔드포인트(GLM 등). 셋 중 하나라도 없으면 AI 질의는 503이다. 키는 서버 런타임에만 둔다. */
  get llm(): { baseUrl: string; apiKey: string; model: string } | null {
    const { LLM_BASE_URL: baseUrl, LLM_API_KEY: apiKey, LLM_MODEL: model } = process.env;
    return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
  },
  /** 사용자당 분당 AI 질의 한도. LLM 비용을 제한한다. */
  get aiRequestsPerMinute(): number {
    return Number(process.env.AI_REQUESTS_PER_MINUTE ?? 20);
  },
};
