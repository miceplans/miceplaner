'use client';

import { createPersistedStore, usePersisted } from '@miceplans/ui/persisted-store';

/** 행사 표의 사용자 정의 속성(컬럼). 모든 행사 표가 이 레지스트리를 공유한다. */
/** 노션식 표 속성 유형. 기존 저장 컬럼은 text로 해석한다. */
export type EventAttrType = 'text' | 'number' | 'date' | 'checkbox';
export type EventAttrColumn = { id: string; label: string; type?: EventAttrType };

const COLUMNS_KEY = 'miceplans.event-attrs.columns';
const VALUES_KEY = 'miceplans.event-attrs.values';
/** 표시 값 없는 셀의 placeholder. */
export const EMPTY_ATTR = '—';

/** 기본 속성. 예산 컬럼은 처음부터 제공된다. */
const DEFAULT_COLUMNS: EventAttrColumn[] = [{ id: 'budget', label: '예산', type: 'number' }];

function decodeColumns(raw: unknown): EventAttrColumn[] {
  if (!Array.isArray(raw)) return DEFAULT_COLUMNS;
  const columns = raw.filter(
    (column): column is EventAttrColumn =>
      !!column && typeof (column as EventAttrColumn).id === 'string' && typeof (column as EventAttrColumn).label === 'string',
  );
  return columns.length ? columns : DEFAULT_COLUMNS;
}

function decodeValues(raw: unknown): Record<string, Record<string, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, Record<string, string>>;
}

const columnsStore = createPersistedStore<EventAttrColumn[]>({ key: COLUMNS_KEY, fallback: DEFAULT_COLUMNS, decode: decodeColumns, delay: 400 });
const valuesStore = createPersistedStore<Record<string, Record<string, string>>>({ key: VALUES_KEY, fallback: {}, decode: decodeValues, delay: 400 });

/**
 * 행사 속성 컬럼과 셀 값을 다루는 공용 훅.
 * 컬럼 추가·값 편집은 localStorage에 지연 저장되고, 같은 페이지의 다른 표도 즉시 반영된다.
 */
export function useEventAttrs() {
  const [columns, setColumns] = usePersisted(columnsStore);
  const [values, setValues] = usePersisted(valuesStore);

  return {
    columns,
    getValue: (eventId: string, columnId: string) => values[eventId]?.[columnId],
    addColumn: (label: string, type: EventAttrType = 'text') => {
      const trimmed = label.trim();
      if (!trimmed) return;
      setColumns((current) => [...current, { id: `attr-${Date.now()}`, label: trimmed, type }]);
    },
    setValue: (eventId: string, columnId: string, value: string) =>
      setValues((current) => ({ ...current, [eventId]: { ...current[eventId], [columnId]: value } })),
  };
}
