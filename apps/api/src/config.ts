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
  /** 하이웍스 Office Token. 서버 런타임에만 둔다. 없으면 가입·로그인을 열지 않는다(503). */
  get hiworksOfficeToken(): string {
    return process.env.OFFICE_TOKEN ?? '';
  },
  /** 하이웍스 메일 도메인. 조직도의 email이 비어 있는 구성원은 `mail_id@도메인`으로 본다. */
  get hiworksMailDomain(): string {
    return process.env.HIWORKS_MAIL_DOMAIN ?? '';
  },
  get hiworksApiUrl(): string {
    return (process.env.HIWORKS_API_URL ?? 'https://api.hiworks.com').replace(/\/$/, '');
  },
  get workspaceId(): string {
    return process.env.WORKSPACE_ID ?? 'miceplans';
  },
  /** CORS·Socket.IO·Swagger UI의 허용 출처(쉼표 구분). 운영에서는 비우면 CORS를 열지 않고, 개발에서는 웹 개발 서버(localhost:3100)만 허용한다. */
  get webOrigin(): string {
    const internal = process.env.WEB_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3100,http://127.0.0.1:3100');
    const client = process.env.CLIENT_PORTAL_ORIGIN ?? '';
    return [internal, client].filter(Boolean).join(',');
  },
  /** Client 포털의 DNS 접두사. 배포에서 `client.<주 도메인>`과 CLIENT_PORTAL_ORIGIN을 같은 값으로 둔다. */
  get clientPortalPrefix(): string {
    return process.env.CLIENT_PORTAL_PREFIX ?? 'client';
  },
  /** 협업 서버 내부 주소와 공유 비밀. Yjs로 편집된 문서의 본문 변경(저장·AI 승인·되돌리기)은 이 서버를 거친다. 없으면 그런 변경은 503이다. */
  get collab(): { url: string; secret: string } | null {
    const { COLLAB_INTERNAL_URL: url, COLLAB_INTERNAL_SECRET: secret } = process.env;
    return url && secret ? { url: url.replace(/\/$/, ''), secret } : null;
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
  /** BGE-M3를 서빙하는 TEI 주소. 없으면 dense 검색과 임베딩 작업을 쓰지 않는다. */
  get teiUrl(): string {
    return process.env.TEI_URL ?? '';
  },
  /** dense 검색에서 이 코사인 거리보다 먼 청크는 관련 없는 것으로 본다. 골든 셋으로 보정할 값이라 환경 변수로 조정한다. */
  get denseMaxDistance(): number {
    return Number(process.env.DENSE_MAX_DISTANCE ?? 0.5);
  },
};
