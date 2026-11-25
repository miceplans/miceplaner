# 백엔드 인프라 (AWS)

realtime·collab·worker를 EC2 한 대의 Docker로 돌린다. 설계 근거는 `docs/adr/0001-technical-decisions.md` 배포 절 참고.

```bash
cd infra && npm install
npx cdk diff -c githubOidcProviderArn=<GitHub OIDC 공급자 ARN> -c cloudFrontPrefixListId=<리전의 com.amazonaws.global.cloudfront.origin-facing ID>
npx cdk deploy ...   # 부트스트랩이 필요 없다(LegacyStackSynthesizer)
```

- 운영 비밀: SSM Parameter Store `/miceplans/prod/*`(SecureString). 필요한 키: `DATABASE_URL`, `JWT_SECRET`, `REALTIME_INTERNAL_SECRET`, `COLLAB_INTERNAL_SECRET`, `WEB_ORIGIN`, `WORKSPACE_ID`, `DATABASE_CA_CERT`(Supabase Root CA PEM, 한 줄로 `\n` 이스케이프. 없으면 운영에서 평문 DB 연결을 거부해 기동하지 않는다)`TEI_API_KEY`(임베딩 서버 키, 32바이트 이상 무작위 값). `S3_BUCKET`·`S3_REGION`과 `TEI_URL`(스택 출력 `EmbedUrl`)은 스택이 자동 등록한다.
- Vercel API의 업로드 버킷 접근: 스택 출력 `ApiFilesUserName` 사용자의 접근 키를 발급해 Vercel API 프로젝트(Production)의 `AWS_ACCESS_KEY_ID`·`AWS_SECRET_ACCESS_KEY`에 넣고 `S3_BUCKET`(출력 `UploadsBucket`)·`S3_REGION=ap-northeast-2`도 함께 넣는다. 키는 CloudFormation 출력에 남지 않게 스택 밖에서 `aws iam create-access-key --user-name <ApiFilesUserName>`으로 만들고, 교체할 때는 새 키를 넣고 재배포한 뒤 이전 키를 삭제한다.
- EC2 AMI는 `lib/backend-stack.ts`의 `HOST_AMI`(Amazon Linux 2023 arm64)로 고정한다. 바꾸면 인스턴스가 교체되므로 AMI를 올릴 때만 `aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64`로 확인해 갱신한다.
- 값을 바꾸면 해당 서비스를 다시 배포(release 워크플로우 `force_all` 또는 SSM으로 `/opt/miceplans/deploy.sh <service> <image>`)해야 `.env`에 반영된다.
- 접속: SSH 없음. `aws ssm start-session --target <InstanceId>`.
- 임베딩 서버(TEI, BGE-M3): 전용 인스턴스 `EmbedHost`(기본 `t4g.medium`, `BackendStack`의 `embedInstanceType`으로 바꾼다). 켜는 순서는 다음과 같다.
  1. 키를 만든다: `aws ssm put-parameter --name /miceplans/prod/TEI_API_KEY --type SecureString --value "$(openssl rand -hex 32)"`. 인스턴스는 키가 생길 때까지 30초마다 다시 시도하므로 스택 배포 전후 어느 쪽이어도 된다.
  2. `cdk deploy` 후 첫 기동에 이미지·모델(약 3GB) 내려받기로 수 분이 걸린다. 확인: `curl -s -H "Authorization: Bearer <키>" -H 'content-type: application/json' -d '{"inputs":["테스트"]}' <EmbedUrl>/embed | head -c 80`
  3. Vercel API 프로젝트(Production)에 `TEI_URL`(= `EmbedUrl`)과 `TEI_API_KEY`를 넣고 API를 다시 배포한다. worker는 다음 배포(`force_all` 또는 `deploy.sh worker <image>`)에서 SSM 값을 받는다.
  4. 기존 문서를 백필한다: `aws ssm start-session --target <InstanceId>` 후 `cd /opt/miceplans && docker compose --env-file images.env -f compose.yml exec worker node_modules/.bin/tsx src/backfill-embeddings.ts <재직 중인 Super Admin userId>`.
  - 로그: `EmbedInstanceId`에 SSM 접속 후 `journalctl -u tei -f`. 키를 바꾸면 `systemctl restart tei`와 Vercel·worker 재배포가 필요하다.
