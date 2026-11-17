# Vercel + 기존 Supabase 배포

웹과 API는 **서로 다른 Vercel 프로젝트**로 배포한다. 웹은 정적 export이고, API는 요청이 있을 때만 실행되는 Node.js 함수다. 따라서 유휴 시간에는 API 서버 비용이 발생하지 않는다.

## Supabase 연결

기존 Supabase 프로젝트의 Dashboard에서 **Connect → Transaction pooler** URI를 복사한다. API는 기본 `postgres` 역할이 아니라 RLS를 우회하지 않는 `miceplans_app` 역할로 접속해야 한다. Supavisor의 커스텀 역할 사용자명은 `<role>.<project-ref>` 형식이다.

마이그레이션을 한 번 적용한 뒤, 직접 연결로 다음을 실행해 앱 역할의 강한 비밀번호를 설정한다. 이 비밀번호는 마이그레이션·Supabase 기본 `postgres` 비밀번호와 분리한다.

```sql
ALTER ROLE miceplans_app PASSWORD '<새 앱 역할 비밀번호>';
```

Vercel API 프로젝트에는 다음처럼 설정한다.

```text
DATABASE_URL=postgresql://miceplans_app.<project-ref>:<app-role-password>@<pooler-host>:6543/postgres?sslmode=require&workaround=supabase-pooler.vercel
DATABASE_POOL_MAX=1
JWT_SECRET=<32자 이상의 무작위 비밀>
WORKSPACE_ID=miceplans
WEB_ORIGIN=https://<web-project>.vercel.app
OFFICE_TOKEN=<Hiworks server token>
HIWORKS_MAIL_DOMAIN=<company-domain>
```

`DATABASE_URL`, `JWT_SECRET`, `OFFICE_TOKEN`은 API 프로젝트에만 넣는다. `NEXT_PUBLIC_*` 변수에는 공개 URL만 둘 수 있으며 DB 비밀번호·Supabase service role 키를 넣으면 안 된다. 특히 API의 `DATABASE_URL`에 기본 `postgres` 계정을 쓰지 않는다. 서버리스에서는 Transaction Pooler와 인스턴스당 연결 하나를 사용한다.

마이그레이션은 Vercel 함수에서 실행하지 않는다. Supabase의 **직접 연결** 또는 마이그레이션 전용 연결 문자열로, 배포 전에 한 번 실행한다.

```bash
DATABASE_URL='직접 연결 문자열' pnpm --filter @miceplans/db migrate
DATABASE_URL='직접 연결 문자열' pnpm --filter @miceplans/queue migrate
```

적용 후에는 Supabase SQL Editor에서 다음을 확인한다. `miceplans_app`의 `rolbypassrls` 값은 반드시 `false`여야 한다.

```sql
SELECT rolname, rolcanlogin, rolbypassrls
FROM pg_roles
WHERE rolname = 'miceplans_app';

SELECT name FROM schema_migrations ORDER BY name;
```

## Vercel 프로젝트 생성

1. 같은 Git 저장소에서 프로젝트를 두 개 만든다.
2. 웹 프로젝트의 Root Directory는 `apps/web`, API 프로젝트의 Root Directory는 `apps/api`로 지정한다. **Build Step의 `Include source files outside of the Root Directory`를 켠다.** 두 앱이 워크스페이스 패키지(`packages/*`)를 참조하기 때문이다. Vercel이 루트 lockfile과 워크스페이스를 자동 감지해 설치한다.
3. API 프로젝트에 위의 서버 환경변수를 Production과 Preview에 설정한다. Preview는 운영 DB를 사용하지 않는 별도 Supabase 브랜치/프로젝트를 권장한다.
4. 웹 프로젝트에는 `NEXT_PUBLIC_API_URL=https://<api-project>.vercel.app`만 설정하고 배포한다.
5. API의 `https://<api-project>.vercel.app/health`가 `{ "ok": true }`를 반환하는지 확인한 다음 웹에서 로그인한다.

## Drizzle migration 자동 배포

스키마 변경은 `drizzle-kit push`로 운영 DB에 직접 동기화하지 않는다. RLS 정책·권한 함수·감사 트리거가 포함되어 있어, 검토 가능한 SQL migration만 자동 적용한다. Drizzle Kit은 custom migration 생성에 사용한다.

```bash
pnpm --filter @miceplans/db drizzle:custom --name add_event_timezone
```

생성된 `packages/db/drizzle/**.sql`에 SQL을 작성하고 테스트한 뒤 커밋한다. `main`에 병합되면 GitHub Actions의 `Deploy Supabase migrations`가 새 SQL과 pg-boss 스키마를 순서대로 적용한다. 실행 이력은 `schema_migrations`에 남아 같은 migration을 다시 적용하지 않는다.

GitHub 저장소의 **Settings → Secrets and variables → Actions**에 아래 repository secret을 한 번 등록한다.

```text
SUPABASE_MIGRATION_URL=<Supabase 직접 연결의 마이그레이션 소유자 URL>
```

이는 API용 Transaction Pooler URL이나 `miceplans_app` URL이 아니라, DDL·역할 생성 권한이 있는 직접 연결이다. GitHub Actions의 `production` Environment에 배포 보호 규칙을 설정하면 운영 스키마 변경마다 승인 단계를 둘 수 있다.

## Vercel에서 제외되는 기능

Vercel 함수는 무상태 요청 처리에는 적합하지만, 이 저장소의 다음 기능은 별도 실행 환경이 필요하다.

- Socket.IO 및 Hocuspocus 장기 연결: 현재 Vercel 공식 한도 문서는 함수가 WebSocket 서버 역할을 지원하지 않는다고 명시한다. 실시간 기능을 출시할 때는 별도 지속 실행 서비스 또는 검증된 Vercel WebSocket 베타를 사용한다.
- `apps/worker`의 pg-boss 소비: 폴링하는 지속 worker라 Vercel에 상주시킬 수 없다. 파일 변환·임베딩을 운영할 때만 작은 별도 worker를 둔다.
- 파일 업로드와 다운로드: Vercel 함수 요청·응답은 4.5MB 제한이 있어 현재 명세의 20MB 파일을 통과시킬 수 없다. 업로드 기능 출시 전, Supabase Storage(S3 호환) multipart/direct upload로 전환하고 API는 권한 검증과 메타데이터 기록만 처리한다.

현재 웹은 정적 UI가 중심이고 Socket.IO 클라이언트를 연결하지 않으므로, 이 구성으로 웹·인증·일반 HTTP API를 가장 작은 운영 단위로 먼저 올릴 수 있다.

## 협업 서버와 파일 저장소 (비용 기준 잠정 선택)

- 협업(Hocuspocus): Fly.io 최소 shared VM 한 대. 유휴 시 자동 정지를 허용하며, Yjs 스냅샷은 PostgreSQL에 있으므로 서버는 무상태다. 클라이언트는 재연결로 복구한다. 접속 토큰 검증과 RLS 컨텍스트 사용은 그대로다.
- 파일 저장소: Supabase Storage 비공개 버킷. 환경 변수는 `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`(`https://<project-ref>.storage.supabase.co/storage/v1/s3`)와 Storage 설정의 S3 접근 키다. 키는 서버 런타임(API·worker)에만 둔다.
- 무료 플랜은 비활성 시 프로젝트가 일시정지되므로 운영 시작 전에 Pro로 전환한다.
- 용량·다운로드가 늘면 `S3_ENDPOINT`만 바꿔 Cloudflare R2 등으로 이전할 수 있다.
