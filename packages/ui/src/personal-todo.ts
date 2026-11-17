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

/** 내 할 일(개인 Todo). 서버 동기화 전까지 비어 있다. */
export const PERSONAL_TODOS: PersonalTodo[] = [];
