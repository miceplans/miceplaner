# 백엔드 인프라 (AWS)

realtime·collab·worker를 EC2 한 대의 Docker로 돌린다. 설계 근거는 `docs/adr/0001-technical-decisions.md` 배포 절 참고.

```bash
cd infra && npm install
npx cdk diff -c githubOidcProviderArn=<GitHub OIDC 공급자 ARN> -c cloudFrontPrefixListId=<리전의 com.amazonaws.global.cloudfront.origin-facing ID>
npx cdk deploy ...   # 부트스트랩이 필요 없다(LegacyStackSynthesizer)
```

- 운영 비밀: SSM Parameter Store `/miceplans/prod/*`(SecureString). 필요한 키: `DATABASE_URL`, `JWT_SECRET`, `REALTIME_INTERNAL_SECRET`, `COLLAB_INTERNAL_SECRET`, `WEB_ORIGIN`, `WORKSPACE_ID`, `DATABASE_CA_CERT`(Supabase Root CA PEM, 한 줄로 `\n` 이스케이프. 없으면 운영에서 평문 DB 연결을 거부해 기동하지 않는다)(선택: `TEI_URL`). `S3_BUCKET`·`S3_REGION`은 스택이 만든 업로드 버킷 값으로 자동 등록된다.
- Vercel API의 업로드 버킷 접근: 스택 출력 `ApiFilesUserName` 사용자의 접근 키를 발급해 Vercel API 프로젝트(Production)의 `AWS_ACCESS_KEY_ID`·`AWS_SECRET_ACCESS_KEY`에 넣고 `S3_BUCKET`(출력 `UploadsBucket`)·`S3_REGION=ap-northeast-2`도 함께 넣는다. 키는 CloudFormation 출력에 남지 않게 스택 밖에서 `aws iam create-access-key --user-name <ApiFilesUserName>`으로 만들고, 교체할 때는 새 키를 넣고 재배포한 뒤 이전 키를 삭제한다.
- EC2 AMI는 `lib/backend-stack.ts`의 `HOST_AMI`(Amazon Linux 2023 arm64)로 고정한다. 바꾸면 인스턴스가 교체되므로 AMI를 올릴 때만 `aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64`로 확인해 갱신한다.
- 값을 바꾸면 해당 서비스를 다시 배포(release 워크플로우 `force_all` 또는 SSM으로 `/opt/miceplans/deploy.sh <service> <image>`)해야 `.env`에 반영된다.
- 접속: SSH 없음. `aws ssm start-session --target <InstanceId>`.
