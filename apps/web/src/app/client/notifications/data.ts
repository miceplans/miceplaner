import { statusTones } from '@miceplans/ui';

export type Tone = 'indigo' | 'yellow' | 'red' | 'green' | 'blue' | 'gray';

/**
 * 알림 아이콘 타일 배경.
 * - red/green/blue: 배경색이 statusTones 의 실패/성공/진행중 배경과 동일하므로 hex 를 statusTones 에서 참조한다.
 * - indigo/yellow/gray: 상태 톤에 해당하지 않는 AI·경고·중립 식별색이므로 토큰 유틸리티 클래스를 유지한다.
 */
export const CHIP: Record<Tone, { className: string; hex?: string }> = {
  indigo: { className: 'bg-ai-tint' },
  yellow: { className: 'bg-notice-bg' },
  red: { className: '', hex: statusTones.error.bg },
  green: { className: '', hex: statusTones.success.bg },
  blue: { className: '', hex: statusTones.progress.bg },
  gray: { className: 'bg-surface-section' },
};

type Row = { id: string; tone: Tone; icon: string; title: string; event: string; when: string; at: string; unread?: boolean };
export type Group = { label: string; badge?: string; height: string; rows: Row[] };

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-10-21T16:12' → '2026.10.21 (수) 16:12' — 요일을 포함한 상세 날짜 */
export function formatNotifyDate(at: string): string {
  const [date, clock] = at.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}.${pad(m)}.${pad(d)} (${weekday}) ${pad(hh)}:${pad(mm)}`;
}

export const GROUPS: Group[] = [];
