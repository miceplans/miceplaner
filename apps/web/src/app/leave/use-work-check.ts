'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeaveRecord } from './data';

/** 목업의 로그인 사용자가 직접 체크한 주말 근무와 대휴 사용 내역. 로컬 퍼스트로 저장한다. */

const WORK_KEY = 'miceplans.leave.weekend-work';
const COMP_USED_KEY = 'miceplans.leave.comp-used';
/** 다른 인스턴스에 변경을 알리는 창 내 이벤트. */
const CHANGE_EVENT = 'miceplans:leave-work-check:change';

/** 로그인 사용자(대표)의 주말 근무 날짜(YYYY-MM-DD). */
function readWeekendWork(): string[] {
  try {
    const raw = window.localStorage.getItem(WORK_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* 목업: 저장값이 깨져 있으면 비어 있는 값으로 돌아간다. */
  }
  return [];
}

function readCompUsed(): LeaveRecord[] {
  try {
    const raw = window.localStorage.getItem(COMP_USED_KEY);
    if (raw) return JSON.parse(raw) as LeaveRecord[];
  } catch {
    /* 동일 */
  }
  return [];
}

/**
 * 주말 근무 체크와 대휴 사용 내역을 다루는 훅.
 * 토·일 근무 1일당 대휴 1일이 발생하며, 변경은 localStorage에 저장돼 같은 브라우저에서 즉시 공유된다.
 */
export function useWorkCheck() {
  const [weekendWork, setWeekendWork] = useState<string[]>([]);
  const [compUsed, setCompUsed] = useState<LeaveRecord[]>([]);

  useEffect(() => {
    setWeekendWork(readWeekendWork());
    setCompUsed(readCompUsed());
  }, []);

  useEffect(() => {
    const reload = () => {
      setWeekendWork(readWeekendWork());
      setCompUsed(readCompUsed());
    };
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const notify = () => window.dispatchEvent(new Event(CHANGE_EVENT));

  const toggleWeekendWork = useCallback((date: string) => {
    const current = readWeekendWork();
    const next = current.includes(date) ? current.filter((d) => d !== date) : [...current, date].sort();
    try {
      window.localStorage.setItem(WORK_KEY, JSON.stringify(next));
    } catch {
      /* 저장 실패 시 세션 동안만 유지 */
    }
    setWeekendWork(next);
    notify();
  }, []);

  /** 대휴 사용 내역을 추가한다. 같은 날짜는 한 번만 센다. */
  const addCompUsed = useCallback((records: LeaveRecord[]) => {
    const current = readCompUsed();
    const dates = new Set(current.map((r) => r.date));
    const next = [...current, ...records.filter((r) => !dates.has(r.date))].sort((a, b) => a.date.localeCompare(b.date));
    try {
      window.localStorage.setItem(COMP_USED_KEY, JSON.stringify(next));
    } catch {
      /* 동일 */
    }
    setCompUsed(next);
    notify();
  }, []);

  /** 발생한 대휴 일수. 주말 근무 1일당 1일이다. */
  const compEarned = weekendWork.length;
  /** 사용한 대휴 일수. */
  const compUsedDays = compUsed.length;
  const compRemaining = compEarned - compUsedDays;

  return { weekendWork, toggleWeekendWork, compUsed, addCompUsed, compEarned, compUsedDays, compRemaining };
}
