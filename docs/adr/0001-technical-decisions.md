# ADR 0001 MICEPLANS 기술 결정

- 상태: 승인
- 결정일: 2026-10-15
- 범위: MICEPLANS와 사내 LLM 위키의 초기 아키텍처

## 맥락

MICEPLANS는 행사 운영 데이터와 사내 지식을 다루며, 내부 직원의 폭넓은 조회 권한과 행사 담당자 중심의 수정 권한을 동시에 보장해야 한다. 고객 포털과 AI 기능은 내부 정보를 노출하지 않아야 하고, 협업 문서와 검색은 권한 모델을 우회하지 않아야 한다.

## 결정

웹을 먼저 배포하고 Electron은 필요할 때 같은 코드를 감싸는 선택적 셸로 도입한다. 핵심 백엔드는 Next.js 서버 기능이 아닌 NestJS API로 제공한다. AI는 읽기와 제안까지만 수행하고 모든 변경은 사람이 승인한다.

### 기술 구성

| 영역 | 결정 | 비고 |
| --- | --- | --- |
| 웹 UI | Next.js와 TypeScript | 정적 export, 웹 우선 배포 |
| 데스크톱 | Electron | 네이티브 알림·파일 드롭 필요 시 도입 |
| UI | Tailwind CSS, Radix, TanStack Query, Zustand, React Hook Form, Zod | 웹과 포털의 공용 UI |
| 업무 API | NestJS | REST와 OpenAPI |
| 일반 실시간 | Socket.IO | 행사·태스크·일정·알림 갱신 |
| AI 스트리밍 | SSE | 토큰 단위 응답 |
| 협업 편집 | TipTap, Yjs, Hocuspocus | 본문 동시 편집·커서·접속자 |
| 주 저장소 | PostgreSQL, pgvector | RLS로 권한 강제 |
| 작업 큐 | pg-boss | Redis는 확장 조건 충족 시 도입 |
| 파일 | S3 | AWS 내 저장소 통일 |
| 임베딩 | BGE-M3 dense, TEI | 초기 검색 구성 |
| 검색 | PostgreSQL FTS, `pg_trgm`, pgvector | 애플리케이션에서 결과 병합 |
| LLM | GLM | OpenAI 호환 어댑터 뒤에 배치 |
| 내부 인증 | Google Workspace OIDC와 PKCE | Client 인증은 미결정 |
| 관측 | Sentry와 OpenTelemetry | AI 호출 로그 별도 저장 |

### 시스템 경계

```text
Internal Web / Client Portal / optional Electron
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

- 일반 업무 데이터의 기준 저장소는 PostgreSQL이다.
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
- Electron 도입 시 `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`를 적용하고 제한된 preload API와 `safeStorage`를 사용한다.

### 검색과 AI

검색은 먼저 RLS 기반 권한 필터를 적용하고, 행사·고객사·문서 유형·최신성 조건을 적용한 후 FTS와 `pg_trgm`, dense 검색 결과를 병합·재정렬한다. 모든 AI 답변은 출처를 제공한다.

AI 도구는 읽기와 proposal 생성으로 제한한다. 변경은 승인 뒤 서버 API가 실행하고 감사 로그에 남긴다. GLM의 도구 호출 품질은 20~30개 골든 셋으로 초기 2주 안에 평가한다. LLM 어댑터는 모델 교체를 가능하게 유지한다.

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

이 결정은 RLS를 중심으로 권한을 한 곳에서 강제하고, Redis와 별도 벡터 DB 없이 초기 운영 복잡도를 낮춘다. 반면 정적 export 경로의 SPA fallback 또는 쿼리 기반 라우팅, PostgreSQL 중심 검색의 한국어 품질, 단일 협업 task의 짧은 배포 중단을 운영 제약으로 받아들인다.

## 대안과 선택 이유

| 결정 | 선택 이유 | 배제한 대안 |
| --- | --- | --- |
| 웹 우선과 선택적 Electron | Client 포털은 웹이 필요하고, 필요 시 셸로 네이티브 기능을 추가 가능 | 데스크톱 우선, Tauri |
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
| Client 인증 | 첫 포털 연동 또는 고객사 SSO 요구가 있을 때 |
| 전사 문서 space | 행사 외 문서 space 추가 직전 |
| Electron | 네이티브 알림 또는 파일 드롭 요구가 확인될 때 |
