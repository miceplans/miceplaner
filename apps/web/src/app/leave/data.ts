/** 연차 사용 현황 타입과 상수. */

export type LeaveEmployee = {
  id: string;
  /** 이름 */
  name: string;
  /** 직무 */
  role: string;
  /** 총 연차 일수 */
  total: number;
  /** 올해 사용 일수 */
  used: number;
  /** 월별 사용 일수(1~12월, 합계는 used와 일치) */
  monthly: number[];
};

/** 잔여 연차가 이 일수 이하면 부족으로 강조한다. */
export const LOW_REMAINING_DAYS = 3;

export const LEAVE_EMPLOYEES: LeaveEmployee[] = [];

/** 로그인 사용자 정보가 연결되기 전 쓰는 빈 값. */
export const LEAVE_ME: LeaveEmployee = { id: 'me', name: '나', role: '', total: 0, used: 0, monthly: [] };

export const MONTH_LABELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function remainingOf(emp: LeaveEmployee): number {
  return emp.total - emp.used;
}

/** 휴가 형태. 아이콘은 Figma 마이스플래너 > 연차 아이콘 섹션에서 가져온다. */
export type LeaveKind = 'full' | 'comp' | 'am-half' | 'pm-half' | 'am-quarter' | 'pm-quarter';

export const LEAVE_KINDS: { kind: LeaveKind; label: string; days: number; icon: string }[] = [
  { kind: 'full', label: '연차', days: 1, icon: '/assets/leave/full.svg' },
  { kind: 'comp', label: '대휴', days: 1, icon: '/assets/leave/comp.svg' },
  { kind: 'am-half', label: '오전 반차', days: 0.5, icon: '/assets/leave/am-half.svg' },
  { kind: 'pm-half', label: '오후 반차', days: 0.5, icon: '/assets/leave/pm-half.svg' },
  { kind: 'am-quarter', label: '오전 반반차', days: 0.25, icon: '/assets/leave/am-quarter.svg' },
  { kind: 'pm-quarter', label: '오후 반반차', days: 0.25, icon: '/assets/leave/pm-quarter.svg' },
];

export type LeaveRecord = { date: string; employeeId: string; kind: LeaveKind };

/** 오늘(YYYY-MM-DD, 로컬 시간대). */
export const LEAVE_TODAY = new Date().toLocaleDateString('sv-SE');

/** 일자별 휴가 사용 내역(date는 YYYY-MM-DD). */
export const LEAVE_RECORDS: LeaveRecord[] = [];
