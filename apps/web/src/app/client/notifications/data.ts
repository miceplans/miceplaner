export type Tone = 'indigo' | 'yellow' | 'red' | 'green' | 'blue' | 'gray';
export const CHIP: Record<Tone, string> = {
  indigo: 'bg-ai-tint',
  yellow: 'bg-notice-bg',
  red: 'bg-error-bg',
  green: 'bg-success-bg',
  blue: 'bg-info-bg',
  gray: 'bg-surface-section',
};

export type Row = { id: string; tone: Tone; icon: string; title: string; event: string; when: string; unread?: boolean };
export type Group = { label: string; badge?: string; height: string; rows: Row[] };

export const GROUPS: Group[] = [
  {
    label: '오늘',
    badge: '새 알림 2',
    height: 'h-[232px]',
    rows: [
      { id: '1', tone: 'indigo', icon: 'type', title: '김한나님이 댓글에서 나를 언급했어요', event: 'KIMES 2026', when: '10분 전', unread: true },
      { id: '2', tone: 'yellow', icon: 'type1', title: '“AI서밋 등록 폼 API 연동” 마감이 03.12에서 03.10으로 앞당겨졌어요', event: 'AI서밋 2026', when: '1시간 전', unread: true },
      { id: '3', tone: 'red', icon: 'type2', title: '“브로슈어 인쇄 견적 3사 비교” 마감까지 2일 남았어요', event: 'KIMES 2026', when: '3시간 전' },
      { id: '4', tone: 'green', icon: 'type3', title: '박서연님이 “초청장 디자인 시안 1안”을 승인했어요', event: 'KIMES 2026', when: '오전 11:20' },
    ],
  },
  {
    label: '어제',
    height: 'h-[174px]',
    rows: [
      { id: '5', tone: 'blue', icon: 'icon', title: '이준호님이 “파트너스 데이 초청 명단”에 댓글을 남겼어요', event: '파트너스 데이 2026', when: '어제 오후 4:12', unread: true },
      { id: '6', tone: 'gray', icon: 'icon1', title: '최민준님이 “KIMES 부스 3D 렌더링 v3” 파일을 올렸어요', event: 'KIMES 2026', when: '어제 오후 1:03' },
      { id: '7', tone: 'blue', icon: 'icon2', title: 'AI가 이번 주 “KIMES 2026” 일정을 요약했어요', event: 'KIMES 2026', when: '어제 오전 9:00' },
    ],
  },
  {
    label: '지난주',
    height: 'h-[174px]',
    rows: [
      { id: '8', tone: 'indigo', icon: 'icon3', title: '“제12회 프랜차이즈 엑스포” 상태가 제안에서 계약으로 바뀌었어요', event: '프랜차이즈 엑스포', when: '3월 5일' },
      { id: '9', tone: 'green', icon: 'icon4', title: '정유나님이 “행사장 실사 예약” 작업을 완료했어요', event: 'AI서밋 2026', when: '3월 4일' },
      { id: '10', tone: 'gray', icon: 'icon5', title: '3월 정기 점검이 3월 9일 새벽 2시에 진행될 예정이에요', event: '시스템 공지', when: '3월 3일' },
    ],
  },
];
