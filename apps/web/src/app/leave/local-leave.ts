/** 서버 저장 전 이 브라우저에만 남긴 주말 근무·대휴 기록. 누구의 기록인지 알 수 없어 자동으로 옮기지 않고 본인이 확인해 등록한다. */

const WORK_KEY = 'miceplans.leave.weekend-work';
const COMP_USED_KEY = 'miceplans.leave.comp-used';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type LocalLeave = { weekendWork: string[]; comp: string[] };

/** 저장값에서 날짜 형식이 맞는 것만 골라 중복 없이 정렬한다. */
export function parseLocalLeave(work: string | null, comp: string | null): LocalLeave {
  const read = (raw: string | null): unknown[] => {
    try {
      const value: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const dates = (list: unknown[]) => [...new Set(list.filter((d): d is string => typeof d === 'string' && DATE.test(d)))].sort();
  return { weekendWork: dates(read(work)), comp: dates(read(comp).map((r) => (r as { date?: unknown } | null)?.date)) };
}

export function readLocalLeave(): LocalLeave {
  try {
    return parseLocalLeave(window.localStorage.getItem(WORK_KEY), window.localStorage.getItem(COMP_USED_KEY));
  } catch {
    return { weekendWork: [], comp: [] };
  }
}

/** 등록하지 못한 기록만 남긴다. */
export function writeLocalLeave(rest: LocalLeave): void {
  try {
    if (rest.weekendWork.length) window.localStorage.setItem(WORK_KEY, JSON.stringify(rest.weekendWork));
    else window.localStorage.removeItem(WORK_KEY);
    if (rest.comp.length) window.localStorage.setItem(COMP_USED_KEY, JSON.stringify(rest.comp.map((date) => ({ date }))));
    else window.localStorage.removeItem(COMP_USED_KEY);
  } catch {
    /* 저장할 수 없는 환경에서는 화면에서만 바꾼다. */
  }
}
