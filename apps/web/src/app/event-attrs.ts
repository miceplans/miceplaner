'use client';

import { useCallback, useEffect, useState } from 'react';

/** 행사 표의 사용자 정의 속성(컬럼). 모든 행사 표가 이 레지스트리를 공유한다. */
/** 노션식 표 속성 유형. 기존 저장 컬럼은 text로 해석한다. */
export type EventAttrType = 'text' | 'number' | 'date' | 'checkbox';
export type EventAttrColumn = { id: string; label: string; type?: EventAttrType };

const COLUMNS_KEY = 'miceplans.event-attrs.columns';
const VALUES_KEY = 'miceplans.event-attrs.values';
/** 표시 값 없는 셀의 placeholder. */
export const EMPTY_ATTR = '—';
/** 다른 인스턴스에 변경을 알리는 창 내 이벤트. */
const CHANGE_EVENT = 'miceplans:event-attrs:change';

/** 기본 속성. 예산 컬럼은 처음부터 제공된다. */
const DEFAULT_COLUMNS: EventAttrColumn[] = [{ id: 'budget', label: '예산', type: 'number' }];

function readColumns(): EventAttrColumn[] {
  try {
    const raw = window.localStorage.getItem(COLUMNS_KEY);
    if (raw) return JSON.parse(raw) as EventAttrColumn[];
  } catch {
    /* 저장값이 깨져 있으면 기본값으로 돌아간다. */
  }
  return DEFAULT_COLUMNS;
}

function readValues(): Record<string, Record<string, string>> {
  try {
    const raw = window.localStorage.getItem(VALUES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Record<string, string>>;
  } catch {
    /* 동일 */
  }
  return {};
}

/**
 * 행사 속성 컬럼과 셀 값을 다루는 공용 훅.
 * 컬럼 추가·값 편집은 localStorage에 저장되고, 같은 페이지의 다른 표도 즉시 반영된다.
 */
export function useEventAttrs() {
  const [columns, setColumns] = useState<EventAttrColumn[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    setColumns(readColumns());
    setValues(readValues());
  }, []);

  useEffect(() => {
    const reload = () => {
      setColumns(readColumns());
      setValues(readValues());
    };
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const notify = () => window.dispatchEvent(new Event(CHANGE_EVENT));

  const addColumn = useCallback(
    (label: string, type: EventAttrType = 'text') => {
      const trimmed = label.trim();
      if (!trimmed) return;
      const next = [...readColumns(), { id: `attr-${Date.now()}`, label: trimmed, type }];
      try {
        window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
      } catch {
        /* 저장 실패 시 세션 동안만 유지 */
      }
      setColumns(next);
      notify();
    },
    [],
  );

  const setValue = useCallback((eventId: string, columnId: string, value: string) => {
    const current = readValues();
    const next = { ...current, [eventId]: { ...current[eventId], [columnId]: value } };
    try {
      window.localStorage.setItem(VALUES_KEY, JSON.stringify(next));
    } catch {
      /* 동일 */
    }
    setValues(next);
    notify();
  }, []);

  return {
    columns,
    getValue: (eventId: string, columnId: string) => values[eventId]?.[columnId],
    addColumn,
    setValue,
  };
}
