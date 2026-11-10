import type { ImportTargetField } from '@miceplans/contracts';

/** 매핑 화면의 시스템 속성 선택지 (서버 계약 importTargetFields와 같은 값). */
export const TARGET_FIELDS: { value: ImportTargetField; label: string }[] = [
  { value: 'name', label: '행사명' },
  { value: 'startDate', label: '기간 · 시작' },
  { value: 'endDate', label: '기간 · 끝' },
  { value: 'client', label: '고객사' },
  { value: 'pm', label: 'PM' },
  { value: 'status', label: '상태' },
  { value: 'place', label: '장소' },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s·.\-_/]+/g, '');

/**
 * 헤더 라벨을 보고 매핑을 짐작한다. 틀린 부분은 사용자가 고친다.
 * 순서가 중요하다(예: '기간 · 시작'은 시작으로 본다).
 */
export function guessMapping(columns: { index: number; label: string }[]): Record<string, ImportTargetField> {
  const rules: [RegExp, ImportTargetField][] = [
    // `행사 시작일`처럼 행사라는 단어를 포함한 날짜 헤더를 행사명으로 오인하지 않도록
    // 단독 `행사`만 행사명으로 취급한다.
    [/행사명|이벤트명|eventname|제목|^name$|^행사$/, 'name'],
    [/시작|개최일?|행사일|start|^date$/, 'startDate'],
    [/끝|종료|마감|end/, 'endDate'],
    [/고객사|클|client|company|주최/, 'client'],
    [/^pm$|담당자|pm$/, 'pm'],
    [/상태|상황|status/, 'status'],
    [/장소|위치|place|location|venue/, 'place'],
  ];
  const mapping: Record<string, ImportTargetField> = {};
  const used = new Set<ImportTargetField>();
  for (const col of columns) {
    const label = norm(col.label);
    for (const [re, field] of rules) {
      if (used.has(field)) continue;
      if (re.test(label)) {
        mapping[String(col.index)] = field;
        used.add(field);
        break;
      }
    }
  }
  return mapping;
}

export const targetFieldLabel = (field: ImportTargetField): string =>
  TARGET_FIELDS.find((f) => f.value === field)?.label ?? field;
