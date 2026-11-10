/**
 * MICEPLANNER 디자인 토큰 상수.
 * CSS 변수(src/design-system.css)와 1:1 대응하며, 스크립트·인라인 스타일에서
 * 프로그래매틱 접근이 필요할 때 사용한다. 값은 Figma 분석 기준.
 */

export const fonts = {
  sans: "'Pretendard', system-ui, -apple-ui, sans-serif",
} as const;

/** px 단위 텍스트 스케일. Tailwind 유틸리티(text-base 등) 사용을 우선한다. */
export const fontSizes = {
  '2xs': 11,
  xs: 12,
  sm: 12.5,
  base: 13,
  md: 13.5,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const brandGradient =
  'linear-gradient(181deg, #ff3939 0%, #f567a5 60%, rgba(245, 169, 103, 0.72) 97%)';

/** 이벤트·워크스페이스 식별용 미니 아바타 팔레트(16px, 흰색 1.5px 테두리). */
export const avatarPalette = ['#ffaf20', '#f567a5', '#4a8cff', '#2ebd85'] as const;

export type StatusToneKey =
  | 'progress'
  | 'success'
  | 'review'
  | 'hold'
  | 'submit'
  | 'error'
  | 'expired'
  | 'scheduled'
  | 'reject';

/** 상태 필(알약) 배경·텍스트 쌍. 모두 rounded-sm, px-2 py-[5px] 규격. */
export const statusTones: Record<StatusToneKey, { label: string; bg: string; fg: string }> = {
  progress: { label: '진행중', bg: '#e2f4ff', fg: '#0086ff' },
  success: { label: '성공', bg: '#dbfbe6', fg: '#00c05b' },
  review: { label: '확인중', bg: '#fff4d9', fg: '#e99825' },
  hold: { label: '보류중', bg: '#fff4ed', fg: '#f38817' },
  submit: { label: '제출', bg: '#f0eaff', fg: '#783dff' },
  error: { label: '실패', bg: '#ffeeee', fg: '#fe525c' },
  expired: { label: '만료', bg: '#f1f1f1', fg: '#7b7b7b' },
  scheduled: { label: '예정', bg: '#e2f4ff', fg: '#2e5fd8' },
  reject: { label: '반려', bg: '#ffe4f0', fg: '#f53488' },
};

/** 레이아웃 표준 치수(px). */
export const layout = {
  buttonHeight: 32,
  headerHeight: 52,
  topbarHeight: 56,
  sidebarWidth: 240,
  appWidth: 1440,
} as const;
