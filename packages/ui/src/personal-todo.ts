/** 개인 Todo(내 할 일). 행사 Subtask와 별개이며 본인에게만 보인다. */
export type PersonalTodo = {
  id: string;
  title: string;
  /** 기간 시작일(월 내 날짜). start~end가 있으면 캘린더에 빗금 바로 표시한다 */
  start?: number;
  /** 기간 종료일(월 내 날짜). start와 함께 쓴다 */
  end?: number;
  /** 마감일(월 내 날짜, 기간 미지정). 해당 날짜에 빗금 동그라미 항목으로 표시한다 */
  due?: number;
  done?: boolean;
};

/** 2025년 3월 내 할 일 목업 (로그인 유저: 박서연) */
export const MARCH_TODOS: PersonalTodo[] = [
  { id: 't1', title: 'KIMES 초청장 발송 준비', start: 3, end: 4, done: true },
  { id: 't2', title: '디자인 시안 최종 확인', due: 5 },
  { id: 't3', title: '인쇄 업체 견적 회신 확인', due: 6 },
  { id: 't4', title: 'KIMES 부스 3D 렌더링 수정', start: 5, end: 8 },
  { id: 't5', title: 'AI서밋 홈페이지 검수', start: 9, end: 11 },
  { id: 't6', title: 'AI서밋 등록 폼 API 연동', due: 18 },
  { id: 't7', title: 'KIMES 홈페이지 워크플로우 점검', start: 24, end: 26 },
  { id: 't8', title: '행사 후 정산 자료 정리', due: 27 },
];
