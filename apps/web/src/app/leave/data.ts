/** 연차 사용 현황 목업 데이터. 연도는 2026년 기준. */

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

export const LEAVE_EMPLOYEES: LeaveEmployee[] = [
  { id: 'e1', name: '황지영', role: '대표', total: 15, used: 8, monthly: [1, 0, 2, 0, 1, 1, 0, 2, 0, 1, 0, 0] },
  { id: 'e2', name: '김한나', role: '기획 팀장', total: 15, used: 11, monthly: [2, 1, 1, 2, 1, 1, 0, 1, 1, 0, 1, 0] },
  { id: 'e3', name: '이준호', role: '운영 팀장', total: 15, used: 5, monthly: [1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0] },
  { id: 'e4', name: '최서연', role: '그래픽 디자이너', total: 15, used: 12, monthly: [1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 0, 0] },
  { id: 'e5', name: '박민수', role: '개발자', total: 15, used: 4, monthly: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0] },
  { id: 'e6', name: '정다은', role: '마케터', total: 15, used: 9, monthly: [1, 0, 1, 0, 2, 0, 1, 0, 2, 1, 0, 1] },
  { id: 'e7', name: '서동현', role: '해외 영업', total: 18, used: 15, monthly: [2, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 0] },
  { id: 'e8', name: '한소미', role: '인사 담당', total: 15, used: 2, monthly: [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
];

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

/** 목업 기준 오늘. */
export const LEAVE_TODAY = '2026-10-22';

/** 일자별 휴가 사용 내역 목업(date는 YYYY-MM-DD). */
export const LEAVE_RECORDS: LeaveRecord[] = [
  { date: '2026-09-03', employeeId: 'e2', kind: 'full' },
  { date: '2026-09-10', employeeId: 'e3', kind: 'am-half' },
  { date: '2026-09-10', employeeId: 'e6', kind: 'full' },
  { date: '2026-09-17', employeeId: 'e3', kind: 'pm-half' },
  { date: '2026-09-18', employeeId: 'e7', kind: 'full' },
  { date: '2026-09-24', employeeId: 'e4', kind: 'full' },
  { date: '2026-09-25', employeeId: 'e6', kind: 'full' },
  { date: '2026-09-28', employeeId: 'e7', kind: 'full' },
  { date: '2026-09-30', employeeId: 'e8', kind: 'full' },
  { date: '2026-10-08', employeeId: 'e1', kind: 'full' },
  { date: '2026-10-14', employeeId: 'e4', kind: 'full' },
  { date: '2026-10-14', employeeId: 'e2', kind: 'pm-half' },
  { date: '2026-10-21', employeeId: 'e6', kind: 'full' },
  { date: '2026-10-22', employeeId: 'e5', kind: 'am-quarter' },
  { date: '2026-10-22', employeeId: 'e3', kind: 'pm-quarter' },
  { date: '2026-10-16', employeeId: 'e8', kind: 'comp' },
  { date: '2026-10-29', employeeId: 'e7', kind: 'full' },
  { date: '2026-11-12', employeeId: 'e5', kind: 'full' },
  { date: '2026-11-19', employeeId: 'e2', kind: 'am-half' },
];
