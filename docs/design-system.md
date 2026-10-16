# MICEPLANS 디자인 시스템

기준일: 2026-10-15 · 출처: Figma 「마이스플래너」 전체 화면 분석

토큰의 단일 출처는 [`packages/ui/src/design-system.css`](../packages/ui/src/design-system.css)(Tailwind CSS v4 `@theme`)와 [`packages/ui/src/tokens.ts`](../packages/ui/src/tokens.ts)다. 이 문서는 토큰의 의미와 사용 규칙을 정의한다. 새 컴포넌트는 임의값(`bg-[#ff3939]`) 대신 토큰 유틸리티(`bg-brand`)를 사용한다. 기존 화면의 임의값도 2026-10-15 기준으로 모두 토큰으로 전환했다(색상·폰트 크기·반경·그림자·폰트 패밀리).

## 1. 색상

### 텍스트(전경)

| 토큰 | 값 | 용도 | 사용 빈도 |
| --- | --- | --- | --- |
| `text-fg` | `#17171c` | primary 텍스트 | 매우 높음(193회) |
| `text-fg-secondary` | `#6e6e79` | secondary 텍스트 · 비활성 내비 · 취소 버튼 라벨 | 최다(210회) |
| `text-fg-tertiary` | `#9c9ca6` | tertiary · 타임스탬프 | 높음(73회) |
| `text-fg-muted` | `#9aa1b5` | 흐린 메타 텍스트 | 중간 |
| `text-fg-disabled` | `#8b95a1` | placeholder · 비활성 | 중간 |
| `text-fg-strong` | `#000000` | 로고 · 최강조 | 낮음 |
| `text-fg-inverse` | `#ffffff` | 브랜드색·사진 위 텍스트 | 높음 |

### 브랜드

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `bg-brand` / `text-brand` | `#ff3939` | primary 버튼, 숫자 뱃지, 강조 도트, User Bubble |
| `bg-brand-tint` | `#fff2f3` | 브랜드 연한 배경(기본 아바타, 칩) |
| `bg-brand-pink` | `#f567a5` | 워크스페이스 도트, 그라디언트 중간색 |
| `bg-brand-soft` · `bg-brand-pink-strong` · `bg-brand-deep` | `#ff6161` · `#f65aab` · `#c93a7b` | 배리언트(히어로 카드 등) |
| `.bg-brand-gradient` | 181° `#ff3939 → #f567a5 → #f5a967(72%)` | AI 로고, 히어로 카드 |

미니 아바타 팔레트(16px, 흰색 1.5px 테두리, Bold 이니셜): `#ffaf20` `#f567a5` `#4a8cff` `#2ebd85` → `avatarPalette`(tokens.ts)

### 표면(배경)·보더

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `bg-surface` | `#ffffff` | 카드 · 페이지 기본 |
| `bg-surface-sunken` | `#fafafb` | 페이지 배경(알림함) |
| `bg-surface-sidebar` | `#fbfbfb` | 사이드바(240px) |
| `bg-surface-subtle` · `bg-surface-muted` | `#fcfcfd` · `#f7f9fc` | 카드 대비 · 연한 패널 |
| `bg-surface-cell` | `#edf1f7` | 테이블 셀 |
| `bg-surface-chip` | `#efeff2` | 스케줄 칩(h20, radius 5) |
| `border-border` | `#e7e7ea` | 기본 보더 · 하단 구분선(View Header) |
| `border-border-soft` · `border-border-strong` | `#ececef` · `#e6e6ea` | 테이블 그리드 · 강조 보더 |

### 상태(배경+텍스트 쌍)

모든 상태 표기는 "연한 틴트 배경 + 채도 있는 텍스트" 조합으로 통일한다. `StatusTag` 컴포넌트 또는 `statusTones`(tokens.ts)를 사용한다.

| 상태 | 배경 | 텍스트 | 토큰 |
| --- | --- | --- | --- |
| 진행중 | `#e2f4ff` | `#0086ff` | `*-info` / `*-info-bg` |
| 성공 | `#dbfbe6` | `#00c05b` | `*-success` / `*-success-bg` |
| 확인중 | `#fff4d9` | `#e99825` | `*-warning` / `*-warning-bg` |
| 보류중 | `#fff4ed` | `#f38817` | `*-warning-hold` / `*-warning-hold-bg` |
| 실패 | `#ffeeee` | `#fe525c` | `*-error` / `*-error-bg` |
| 제출 | `#f0eaff` | `#783dff` | `*-submit` / `*-submit-bg` |
| 만료 | `#f1f1f1` | `#7b7b7b` | `*-expired` / `*-expired-bg` |
| 지연 | — | `#c4382e` | `text-error-delay` |
| 경고 배너 | `#fcf4dc` | `#9a6e00` | `*-notice` / `*-notice-bg` |

추가: 성공 도트·미니 아바타 `#2ebd85`(`*-success-solid`), 진한 그린 텍스트 `#157a50`(`*-success-deep`).

### AI 액센트

AI 기능은 브랜드 레드와 분리된 바이올렛 계열 액센트를 쓴다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `text-ai` / `bg-ai` | `#4a4ec4` | AI 라벨 · 아이콘 칩 텍스트 |
| `bg-ai-tint` | `#eeeffb` | AI 아이콘 칩 · New/DDay 칩 배경 |

## 2. 타이포그래피

모든 UI 텍스트(한국어·영문·숫자 포함)는 **Pretendard**(기본 `font-sans`)를 쓴다. Inter·Preahvihear는 외부 위젯·특이 케이스에 한정하며 시스템에 포함하지 않는다.

| 유틸리티 | 크기 | 역할 |
| --- | --- | --- |
| `text-2xs` | 11px | Tag Label(400) · Chip Label(500) · Step Number(600) · 아바타 이니셜 소형 |
| `text-xs` | 12px | Caption(400) · Caption Medium(500) · 상태 라벨(700) · 타임스탬프 |
| `text-sm` | 12.5px | Body Small(400) · Label(600) · 메타 라벨 |
| `text-base` | 13px | **Body(400)** · Body Medium(500) · Subtitle(600) · Title(700) · 버튼 · 그룹 헤더 |
| `text-md` | 13.5px | Body Large(400) · 목록 강조 |
| `text-lg` | 16px | 화면 소제목(600) · 본문 강조 |
| `text-xl` | 20px | 화면 제목(600·700, letter-spacing -0.008em) · 수치 강조 |
| `text-2xl` | 24px | 통계 수치(700, -0.02em) |
| `text-3xl` | 32px | 히어로 수치(700, -0.03em) |

- 기본 line-height는 1.4. 큰 수치(20px+)는 1.2~1.5로 조금 여유를 둔다.
- 올캡·어컬러크 라벨은 letter-spacing +0.03~0.1em, 큰 수치는 -0.02~-0.03em.
- 아바타 이니셜: 16px 아바타 Bold 7, 18~24px SemiBold 9~10, 30px Bold 11.

## 3. 반경·간격·그림자

| 유틸리티 | 값 | 용도 |
| --- | --- | --- |
| `rounded-xs` | 5px | 스케줄 칩 |
| `rounded-sm` | 6px | 버튼 · 상태 필 · 배지 테두리 |
| `rounded-md` | 8px | 카드 · 아바타 · 입력 · 내비 항목 |
| `rounded-lg` | 10px | 콘텐츠 카드 · 채팅 버블 |
| `rounded-xl` · `rounded-2xl` | 12px · 20px | 대형 카드 · 사이드 패널 · 연락 카드 |
| `rounded-full` | 999px | 숫자 배지 · 세그먼트 |

- 간격: `gap` 4/6/8/10/12 기본 단계. 수평 패딩은 행 16px, 버튼 14px, 필 8px가 표준.
- 그림자: `shadow-card`(표준 카드) · `shadow-widget`(위젯) · `shadow-segment`(세그먼트) · `shadow-panel`(좌측 드로어) · `drop-shadow-ai`(AI FAB 로고의 검은 그림자).

## 4. 컴포넌트 규격

| 항목 | 규격 |
| --- | --- |
| 기본 버튼(`Button`) | h32 · px 14 · gap 6 · rounded-sm · 라벨 13/500. primary=`bg-brand` 흰 텍스트, secondary=흰 배경 + `border-border` + `text-fg-secondary` |
| 숫자 뱃지(`Badge`) | h18 · px 7 · rounded-full · `bg-brand` · 10.5/600 흰색 |
| 상태 필(`StatusTag`) | h24 · px 8 · gap 4 · rounded-sm · 라벨 12/700 · 아이콘 12~14px |
| 스케줄 칩 | h20 · px 6 · gap 4 · rounded-xs · `bg-surface-chip` · 도트 5px · 11/500 |
| 아이콘 칩 | 34×34 · rounded-md · `bg-ai-tint` · 아이콘 `text-ai` |
| 아바타 | 16(스택) / 24(사이드바, `bg-brand-tint`+`text-brand`) / 30(담당자) px |
| View Header | h52 · px 16 · 하단 1px `border-border` |
| Topbar | h56 · px 16 · gap 12 |
| 테이블 행 | 헤더 h36 · 스케줄 h44 · 목록 h48 |
| 앱 프레임 | 폭 1440 · 사이드바 240 · 콘텐츠 카드 최대 760 |

## 5. 사용 규칙

1. 새 코드는 토큰 유틸리티만 쓴다. 토큰에 없는 색·크기가 필요하면 먼저 이 문서와 토큰에 추가한 뒤 사용한다.
2. 상태 표기는 색 상수를 직접 쓰지 않고 `StatusTag`/`statusTones`로 통일한다.
3. 브랜드(#ff3939)는 행동 유도(버튼·배지)에, AI 바이올렛은 AI 기능 식별에만 쓴다.
4. 다크 모드는 미정의다. 토큰에 다크 팔레트를 추가할 때 `@theme` 확장으로만 반영한다.
