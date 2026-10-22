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

export function usageRateOf(emp: LeaveEmployee): number {
  return emp.used / emp.total;
}
