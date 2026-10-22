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

export type Row = { id: string; tone: Tone; icon: string; title: string; event: string; when: string; at: string; unread?: boolean };
export type Group = { label: string; badge?: string; height: string; rows: Row[] };

// 목업 기준일('오늘'): 2026-10-22. 아래 at(절대 시각) 값의 기준이다.
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

export const GROUPS: Group[] = [
  {
    label: '오늘',
    badge: '새 알림 2',
    height: 'h-[232px]',
    rows: [
      { id: '1', tone: 'indigo', icon: 'type', title: '김한나님이 댓글에서 나를 언급했어요', event: 'KIMES 2026', when: '10분 전', at: '2026-10-22T17:47', unread: true },
      { id: '2', tone: 'yellow', icon: 'type1', title: '“AI서밋 등록 폼 API 연동” 마감이 03.12에서 03.10으로 앞당겨졌어요', event: 'AI서밋 2026', when: '1시간 전', at: '2026-10-22T16:52', unread: true },
      { id: '3', tone: 'red', icon: 'type2', title: '“브로슈어 인쇄 견적 3사 비교” 마감까지 2일 남았어요', event: 'KIMES 2026', when: '3시간 전', at: '2026-10-22T14:45' },
      { id: '4', tone: 'green', icon: 'type3', title: '박서연님이 “초청장 디자인 시안 1안”을 승인했어요', event: 'KIMES 2026', when: '오전 11:20', at: '2026-10-22T11:20' },
    ],
  },
  {
    label: '어제',
    height: 'h-[174px]',
    rows: [
      { id: '5', tone: 'blue', icon: 'icon', title: '이준호님이 “파트너스 데이 초청 명단”에 댓글을 남겼어요', event: '파트너스 데이 2026', when: '어제 오후 4:12', at: '2026-10-21T16:12', unread: true },
      { id: '6', tone: 'gray', icon: 'icon1', title: '최민준님이 “KIMES 부스 3D 렌더링 v3” 파일을 올렸어요', event: 'KIMES 2026', when: '어제 오후 1:03', at: '2026-10-21T13:03' },
      { id: '7', tone: 'blue', icon: 'icon2', title: 'AI가 이번 주 “KIMES 2026” 일정을 요약했어요', event: 'KIMES 2026', when: '어제 오전 9:00', at: '2026-10-21T09:00' },
    ],
  },
  {
    label: '지난주',
    height: 'h-[174px]',
    rows: [
      { id: '8', tone: 'indigo', icon: 'icon3', title: '“제12회 프랜차이즈 엑스포” 상태가 제안에서 계약으로 바뀌었어요', event: '프랜차이즈 엑스포', when: '10월 14일', at: '2026-10-14T10:30' },
      { id: '9', tone: 'green', icon: 'icon4', title: '정유나님이 “행사장 실사 예약” 작업을 완료했어요', event: 'AI서밋 2026', when: '10월 13일', at: '2026-10-13T15:45' },
      { id: '10', tone: 'gray', icon: 'icon5', title: '3월 정기 점검이 3월 9일 새벽 2시에 진행될 예정이에요', event: '시스템 공지', when: '10월 12일', at: '2026-10-12T09:30' },
    ],
  },
];
