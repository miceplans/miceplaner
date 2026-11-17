# MICEPLANNER 작업 가이드

## 문서 우선

- 기능을 구현하거나 정책을 변경하기 전에 [docs/functional-specification.md](docs/functional-specification.md)와 [docs/adr/0001-technical-decisions.md](docs/adr/0001-technical-decisions.md)를 읽는다.
- 문서에 `미확정`으로 표시된 항목은 임의로 결정하지 않는다. 구현에 반드시 필요하면 사용자에게 결정이 필요함을 알리거나, 명확히 분리 가능한 준비 작업만 한다.
- 기능·정책·기술 결정이 바뀌면 관련 문서도 같은 변경에 포함한다.

## 초기 구현 범위

1단계에서는 `apps/web`, `apps/api`, `packages/db`, `packages/contracts`, `packages/domain`, `packages/ui`, `packages/config`과 루트 설정을 우선한다. `portal`, `collaboration`, `worker`, `editor-schema`, `knowledge`, `ai`, `desktop`은 해당 기능 단계가 시작될 때 추가한다.

## 백엔드 비용 최적화

- 백엔드의 설계·기술 선택·운영 방식에서는 서버 비용 최소화를 최우선 기준으로 삼는다.
- 관리형·서버리스 기능으로 대체 가능한 상시 실행 서버, 별도 캐시·큐·검색 클러스터는 실제 기능·성능 요구가 확인되기 전에는 추가하지 않는다.
- 인프라 구성요소를 새로 도입할 때는 월 고정비, 사용량 비용, 운영 비용을 함께 비교하고 가장 단순하고 저렴한 구성을 선택한다.
- 비용 최적화는 권한 검증, PostgreSQL RLS, 백업·복구, 감사 로그, 데이터 보호 요구를 완화하는 근거가 될 수 없다.
- 개인 Todo처럼 다른 사용자·업무 흐름과 공유되지 않는 데이터는 local-first로 구현한다. 먼저 사용자의 컴퓨터에 저장하고, 서버 동기화는 다중 기기 복구 등 명확한 요구가 생긴 경우에만 추가한다.

## 아키텍처 경계

- 앱은 패키지만 import하며, 앱끼리 직접 import하지 않는다.
- Client 포털은 `contracts/portal`과 `ui`만 사용한다. 내부 도메인 규칙, 소켓 계약, 검색·위키 데이터에 접근하면 안 된다.
- HTTP DTO, Socket.IO 이벤트, AI 도구의 입출력은 반드시 `packages/contracts`에서 Zod 스키마로 정의한다.
- 도메인 역할·상태·권한 규칙은 `packages/domain`의 순수 함수에 둔다.
- DB 클라이언트는 repository 외부에서 직접 사용하지 않는다.

## 권한과 데이터 보호

- 권한은 애플리케이션 코드와 PostgreSQL RLS에서 모두 강제한다.
- 모든 DB 접근은 요청 또는 작업 단위 트랜잭션 안에서 `withContext({ workspaceId, userId, role }, fn)`을 통해 수행한다.
- `BYPASSRLS`가 있는 애플리케이션 역할이나 무제한 서비스 역할을 만들거나 사용하지 않는다.
- 행사에 연결된 데이터는 `event_id`를 유지해 `can_edit_event(event_id)` 기준으로 권한을 판정할 수 있게 한다.
- Client에는 공개 전용 데이터만 제공한다. 내부 위키, 검색 결과, 첨부 메타데이터, Socket.IO, Hocuspocus, AI 도구 접근은 허용하지 않는다.
- 삭제는 soft delete가 기본이다. 영구 삭제, 내보내기, 멤버·권한 변경, 담당자 변경, 공개 상태 변경, AI 승인 반영은 감사 로그 대상이다.

## 동시성 및 AI

- 제목·설명 같은 일반 텍스트는 마지막 저장 우선으로 처리한다.
- 담당자, 마감일, 공개 상태는 version 충돌을 확인하고 충돌 시 사용자에게 안내한다.
- 위키 본문은 Yjs로 병합한다. Yjs 원본이 기준이며 Markdown은 검색·AI용 파생본이다.
- AI는 읽기와 proposal 생성만 한다. 변경은 사용자가 승인한 후 서버 API가 실행한다.
- AI 도구 추가 시 `contracts/agent-tools` 스키마와 평가 케이스를 함께 추가한다.

## 품질 검증

- 단위 테스트는 코드 옆 `*.spec.ts`에 둔다.
- RLS·DB 정책은 `packages/db/test`에서 실제 PostgreSQL 정책으로 검증한다.
- API 종단 간 테스트는 `apps/api/test`에 둔다.
- 패키지 경계는 CI에서 ESLint boundaries 또는 dependency-cruiser로 검증한다.
- 변경 전후로 관련 테스트, 타입 검사, 린트를 실행한다. 실행하지 못한 검증은 완료 보고에 명시한다.

## 작업 원칙

- 기존의 사용자 변경은 보존하고, 요청 범위 밖의 리팩터링을 섞지 않는다.
- 비밀 값은 서버 런타임에만 둔다. 브라우저, Next 정적 산출물, Tauri 웹뷰에 DB·LLM·S3 자격 증명을 넣지 않는다.
- 코드와 문서의 언어는 기존 파일의 언어와 스타일을 따른다.
