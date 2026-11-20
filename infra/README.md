# 백엔드 인프라 (AWS)

realtime·collab·worker를 EC2 한 대의 Docker로 돌린다. 설계 근거는 `docs/adr/0001-technical-decisions.md` 배포 절 참고.

```bash
cd infra && npm install
npx cdk diff -c githubOidcProviderArn=<GitHub OIDC 공급자 ARN> -c cloudFrontPrefixListId=<리전의 com.amazonaws.global.cloudfront.origin-facing ID>
npx cdk deploy ...   # 부트스트랩이 필요 없다(LegacyStackSynthesizer)
```

- 운영 비밀: SSM Parameter Store `/miceplans/prod/*`(SecureString). 필요한 키: `DATABASE_URL`, `JWT_SECRET`, `REALTIME_INTERNAL_SECRET`, `COLLAB_INTERNAL_SECRET`, `WEB_ORIGIN`, `WORKSPACE_ID`(선택: `TEI_URL`). `S3_BUCKET`·`S3_REGION`은 스택이 만든 업로드 버킷 값으로 자동 등록된다.
- 값을 바꾸면 해당 서비스를 다시 배포(release 워크플로우 `force_all` 또는 SSM으로 `/opt/miceplans/deploy.sh <service> <image>`)해야 `.env`에 반영된다.
- 접속: SSH 없음. `aws ssm start-session --target <InstanceId>`.
