/** 실행 환경 설정. process.env를 읽는 시점에 해석한다. 비밀(DB·S3·임베딩 서버)은 서버 런타임에만 둔다. */
export const config = {
  get databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL이 필요하다 (miceplans_app 역할의 접속 문자열)');
    return url;
  },
  /** API와 같은 워크스페이스 ID. 백필처럼 작업 입력 없이 실행할 때 RLS 컨텍스트에 쓴다. */
  get workspaceId(): string {
    return process.env.WORKSPACE_ID ?? 'miceplans';
  },
  /** BGE-M3를 서빙하는 TEI 주소. 없으면 임베딩 작업은 건너뛰고 검색은 lexical만 쓴다. */
  get teiUrl(): string {
    return process.env.TEI_URL ?? '';
  },
  /** TEI `--api-key`. 운영 TEI는 CloudFront로 공개되므로 TEI_URL과 함께 둔다. */
  get teiApiKey(): string {
    return process.env.TEI_API_KEY ?? '';
  },
};
