# ADR 0001 MICEPLANS 기술 결정

- 상태: 승인
- 결정일: 2026-10-15
- 범위: MICEPLANS와 사내 LLM 위키의 초기 아키텍처

## 맥락

MICEPLANS는 행사 운영 데이터와 사내 지식을 다루며, 내부 직원의 폭넓은 조회 권한과 행사 담당자 중심의 수정 권한을 동시에 보장해야 한다. 고객 포털과 AI 기능은 내부 정보를 노출하지 않아야 하고, 협업 문서와 검색은 권한 모델을 우회하지 않아야 한다.

## 결정

웹을 먼저 배포하고 Tauri는 필요할 때 같은 코드를 감싸는 선택적 셸로 도입한다. 핵심 백엔드는 Next.js 서버 기능이 아닌 NestJS API로 제공한다. AI는 읽기와 제안까지만 수행하고 모든 변경은 사람이 승인한다.

### 기술 구성

| 영역 | 결정 | 비고 |
| --- | --- | --- |
| 웹 UI | Next.js와 TypeScript | 정적 export, 웹 우선 배포 |
| 데스크톱 | Tauri 2 | 네이티브 알림·파일 드롭 필요 시 도입. 웹 정적 export를 웹뷰에 로드 |
| UI | Tailwind CSS, Radix, TanStack Query, Zustand, React Hook Form, Zod | 웹과 포털의 공용 UI |
| 업무 API | NestJS | REST와 OpenAPI |
| 웹 API 클라이언트 | orval + TanStack Query | `apps/api`가 내보낸 `openapi.json`(`pnpm api:spec`)에서 fetch 클라이언트와 Query 훅을 생성한다. 토큰·401·오류 메시지는 `apps/web/src/lib/api/http.ts` 한곳에서 처리하고, SSE(`/ai/chat`)는 스트림이라 직접 구현한다. 생성 결과(`apps/web/src/lib/api/generated`)와 `openapi.json`은 커밋한다. |
| 일반 실시간 | Socket.IO | 행사·태스크·일정·알림 갱신 |
| AI 스트리밍 | SSE | 토큰 단위 응답 |
| 협업 편집 | TipTap, Yjs, Hocuspocus | 본문 동시 편집·커서·접속자 |
| 주 저장소 | PostgreSQL, pgvector | RLS로 권한 강제 |
| 작업 큐 | pg-boss | Redis는 확장 조건 충족 시 도입 |
| 파일 | S3 | AWS 내 저장소 통일 |
| 임베딩 | BGE-M3 dense, TEI | 초기 검색 구성 |
| 검색 | PostgreSQL FTS, `pg_trgm`, pgvector | 애플리케이션에서 결과 병합 |
| LLM | GLM | OpenAI 호환 어댑터 뒤에 배치 |
| 내부 인증 | 이메일·비밀번호(scrypt) + 하이웍스 조직도 구성원 검증 | Google OIDC는 철회(2026-11-03). 하이웍스 OAuth는 신규 발급이 중단되어 쓰지 않는다. 메일 소유 확인이 없어 자유 가입 선점 위험을 감수한다. Client는 `client.` 포털에서 회사명·이름·이메일·비밀번호로 신청하고 Super Admin 승인 뒤 로그인한다. |
| 관측 | Sentry와 OpenTelemetry | AI 호출 로그 별도 저장 |

### 배포

일반 HTTP API는 Vercel Node Function으로 요청 시에만 실행한다. API 함수는 `tsup`으로 workspace 코드를 단일 ESM 번들로 만들고, Vercel 함수 진입점은 그 산출물만 불러온다. ESM 전용 `jose`와 동적 `require`를 사용하는 `pg`는 번들 밖에 두어 Node 런타임이 직접 해석한다. Vercel의 `Other` 프리셋이 요구하는 `public` 출력 디렉터리는 빌드 때 `index.html`을 만들어 비어 있지 않게 하며, 모든 HTTP 메서드와 중첩 경로는 Vercel `routes` 규칙으로 catch-all 함수 파일에 직접 보낸다. API 번들은 정적 산출물이 아니라 함수에만 포함한다. 이는 워크스페이스 TypeScript 소스의 확장자 없는 ESM import를 Vercel 런타임이 개별적으로 해석하는 문제를 피한다. Socket.IO·협업·worker처럼 지속 연결 또는 폴링이 필요한 프로세스는 Vercel 함수에 두지 않는다.

### 시스템 경계

```text
Internal Web / Client Portal / optional Tauri
                 │ REST, SSE, Socket.IO
                 ▼
              NestJS API ───────── PostgreSQL with RLS and pgvector
                 │                         ▲
                 │                         │ context-bound access
                 ▼                         │
       Hocuspocus collaboration ───────────┤
                 │                         │
                 └──── pg-boss worker ─────┘
                              │
                              ├── S3
                              └── TEI embedding service
```

Client 포털은 API만 호출한다. 협업 서버는 Client 연결을 받지 않는다. API, 협업 서버, worker는 모두 무제한 DB 역할 없이 같은 RLS 원칙을 적용한다.

### 저장과 실시간

- 행사·공유 업무 데이터의 기준 저장소는 PostgreSQL이다. 개인 Todo는 서버 비용과 의존성을 줄이기 위해 사용자 컴퓨터의 로컬 저장소를 기준으로 하는 local-first 데이터이며, 초기 범위에서는 서버에 동기화하지 않는다.
- 위키 본문은 Yjs 원본을 기준으로 저장하며 Markdown은 검색과 AI 읽기용 파생본이다.
- Yjs 데이터는 update log, snapshot, `wiki_revision`으로 분리한다. update log는 스냅샷 이후 정리하고, 사용자 명시적 이력·제안 승인·발행·되돌리기 때만 revision을 생성한다.
- Socket.IO는 업무 객체 갱신을 알리고 클라이언트는 쿼리 캐시를 무효화한다. Yjs는 위키 본문에만 사용한다. AI 응답만 SSE로 보낸다.
- 1단계 협업 서버는 단일 ECS task로 운영한다. 배포 중 연결 단절은 허용하며 클라이언트는 재접속 후 동기화한다. Presence는 일시 상태이므로 복구하지 않는다.

### 권한과 보안

- 앱 코드와 PostgreSQL RLS를 모두 적용한다.
- 모든 서비스는 `BYPASSRLS`가 없는 역할로 접속한다.
- 요청 또는 작업 단위 트랜잭션에서 `SET LOCAL`로 `workspace_id`, 사용자, 역할 컨텍스트를 설정한다.
- worker와 협업 서버도 처리 대상의 워크스페이스와 주체를 명시한다.
- 협업 연결은 JWT와 문서 space 권한을 검증하고, 권한 회수 시 읽기 전용 전환 또는 연결 종료를 수행한다.
- Client는 별도 주체 모델로 관리하고, 공개 전용 뷰 또는 모델에서 배정 및 공개 여부를 직접 필터한다. 공개 뷰의 소유자 권한 실행이 RLS를 우회할 수 있으므로 뷰 내부 조건은 필수다.
- Tauri 도입 시 capabilities·permissions를 최소 권한으로 선언하고, 허용한 Tauri command만 노출한다. 원격 URL 로드는 허용 목록으로 제한하고 CSP를 적용한다. 토큰 등 로컬 비밀은 OS keychain에 저장하며 DB·LLM·S3 자격 증명은 두지 않는다. Rust 코드는 셸 기능(트레이, 알림, 파일 드롭, 딥링크, 자동 업데이트)으로 제한하고 업무 규칙은 두지 않는다.

### 검색과 AI

한국어 검색은 서버 비용을 우선해 형태소 분석기를 두지 않는다. 색인은 `simple` tsvector, 질의는 조사 제거 후 어간 접두 일치와 `pg_trgm`이며, WASM Kiwi(`kiwi-nlp`)는 상시 메모리 700~900MB라 API·worker에 상주시키기 어렵다고 판단해 배제했다. 골든 셋이 기준 미달이면 worker 한정 Kiwi 또는 별도 검색 엔진을 재검토한다. 임베딩 서빙(TEI)과 pgvector는 위키 외 문서 검색 요구가 확인될 때 추가한다.

협업 서버(`apps/collaboration`)는 연결마다 세션 토큰을 검증하고 사용자의 RLS 컨텍스트로 DB에 접근한다. Yjs는 문서당 병합된 스냅샷 하나를 PostgreSQL(`wiki_ydoc`)에 저장해 별도 저장소를 두지 않는다. API가 협업 서버로 본문 변경(AI 승인·되돌리기)을 요청하는 내부 경로는 공유 비밀로 보호하며 네트워크에서도 내부로 제한한다.

검색은 먼저 RLS 기반 권한 필터를 적용하고, 행사·고객사·문서 유형·최신성 조건을 적용한 후 FTS와 `pg_trgm`, dense 검색 결과를 병합·재정렬한다. 모든 AI 답변은 출처를 제공한다.

업로드 파일은 worker가 Markdown으로 변환해 `event_docs`와 `knowledge_chunks`로 들어가므로 위키와 같은 RLS를 따른다. 원본은 S3에 두고 API가 대신 전달한다. dense 임베딩 열은 pgvector가 있는 서버에서만 만들며, 없거나 `TEI_URL`이 없으면 검색은 lexical만 쓴다. pg-boss 스키마는 배포 때 소유자 역할로 만들고 앱·worker 역할에는 DDL 권한을 주지 않는다. 자세한 동작과 미확정 항목(원본 보존 기간, 임베딩 서빙 비용, 거리 임계값)은 기능 명세 F-10과 6절에 있다.

AI 도구는 읽기와 proposal 생성으로 제한하며 사용자의 RLS 컨텍스트에서 실행된다. 사람 이름은 LLM 전송 직전에 요청별 `<PERSON_001>` 토큰으로 가리고, SSE 출력에서만 메모리 대응표로 복원한다. 예산은 AI 경계의 비가역 차단 대상이라 도구 출력·프롬프트·호출 로그에 포함하지 않는다. 승인 반영은 승인자 권한으로 서버가 한 PostgreSQL 트랜잭션에서 수행한다. AI 위키 승인은 API가 Yjs 원본과 Markdown 파생본, 색인, revision, proposal 결정, 감사 로그를 함께 저장하고, 커밋 뒤 협업 서버는 열린 연결에 상태만 전파한다. 이 순서는 별도 협업 서버 DB 트랜잭션과 API 트랜잭션을 하나의 분산 트랜잭션처럼 취급하지 않게 한다. 변경은 승인 뒤 서버 API가 실행하고 감사 로그에 남긴다. GLM의 도구 호출 품질은 20~30개 골든 셋으로 초기 2주 안에 평가한다. LLM 어댑터는 모델 교체를 가능하게 유지한다.

### 레포지터리 구조

초기 모노레포는 `apps/web`, `apps/api`, `packages/db`, `packages/contracts`, `packages/domain`, `packages/ui`, `packages/config`과 루트 설정을 먼저 만든다. `portal`, `collaboration`, `worker`, `editor-schema`, `knowledge`, `ai`는 기능 단계에 맞춰 추가한다.

```text
apps/
  web/             internal web, static export
  portal/          Client portal, portal contracts and ui only
  api/             NestJS API, authorization, search, agent, Socket.IO
  collaboration/   Hocuspocus server
  worker/          pg-boss jobs
packages/
  db/              Drizzle schema, migrations, RLS policies, context helpers
  contracts/       Zod HTTP, socket, agent-tool, portal contracts
  domain/          pure domain and authorization rules
  editor-schema/   shared editor nodes, Yjs and Markdown helpers
  knowledge/       parse, chunk, embed, search
  ai/              LLM adapter, tools, prompts, evals
  ui/              shared design system
  config/          shared TypeScript and lint configuration
```

앱은 패키지만 import하고 다른 앱을 import하지 않는다. 포털은 `contracts/portal`과 `ui`만 사용한다. DB 클라이언트는 repository 외부에서 직접 import하지 않으며 `withContext()` 안에서만 접근한다. 이 경계는 ESLint boundaries 또는 dependency-cruiser로 CI에서 검증한다.

## 결과

이 결정은 RLS를 중심으로 권한을 한 곳에서 강제하고, Redis와 별도 벡터 DB 없이 초기 운영 복잡도를 낮춘다. 반면 정적 export 경로의 SPA fallback 또는 쿼리 기반 라우팅, PostgreSQL 중심 검색의 한국어 품질, 단일 협업 task의 짧은 배포 중단, Tauri의 OS별 웹뷰 차이를 운영 제약으로 받아들인다.

## 대안과 선택 이유

| 결정 | 선택 이유 | 배제한 대안 |
| --- | --- | --- |
| 웹 우선과 선택적 Tauri | Client 포털은 웹이 필요하고, 필요 시 같은 웹 코드를 가벼운 셸로 감싸 네이티브 기능을 추가 가능 | 데스크톱 우선, Electron |
| NestJS | 모듈, DI, OpenAPI가 팀 확장에 유리 | Hono |
| PostgreSQL 단일 저장소 | 정형 데이터, 위키, 벡터의 권한 정책을 한 번만 관리 | 별도 벡터 DB |
| pg-boss | Redis 없이 PostgreSQL 위에서 작업 큐 운영 | BullMQ |
| Yjs와 Hocuspocus | 동시 편집과 presence를 제공 | 소프트 락, 외부 협업 SaaS |
| Yjs 원본과 Markdown 파생본 | 서식 손실 없는 편집 원본과 검색 친화 파생본을 분리 | Markdown 원본 저장 |
| 제안만 하는 AI | 행사 운영의 잘못된 자동 변경 비용을 제한 | 자동 실행 AI |
| S3 | AWS 인프라를 한 곳에 통일 | Cloudflare R2 |

## 재검토 조건

| 항목 | 조건 |
| --- | --- |
| Redis | 협업 서버를 두 개 이상 운영하거나 동시 접속이 증가할 때 |
| 검색 구성 | 골든 셋에서 한국어 검색 품질이 기준 미달일 때 |
| LLM | 초기 2주 평가에서 GLM 도구 호출 품질이 기준 미달일 때 |
| Client 인증 | 고객사 SSO 요구가 생길 때 |
| 전사 문서 space | 행사 외 문서 space 추가 직전 |
| Tauri | 네이티브 알림 또는 파일 드롭 요구가 확인될 때. 위키 에디터가 OS 웹뷰(WebKit·WebView2)에서 정상 동작하는지 도입 전 검증 |
