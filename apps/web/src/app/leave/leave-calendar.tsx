'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LEAVE_EMPLOYEES, LEAVE_KINDS, LEAVE_RECORDS, LEAVE_TODAY } from './data';
import { useWorkCheck } from './use-work-check';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const KIND_BY_ID = new Map(LEAVE_KINDS.map((k, i) => [k.kind, { ...k, order: i }]));
const NAME_BY_ID = new Map(LEAVE_EMPLOYEES.map((e) => [e.id, e.name]));
/** 목업: 로그인 사용자는 대표(e1)로 가정한다. */
const ME = LEAVE_EMPLOYEES[0]!;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function LeaveCalendar() {
  const router = useRouter();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10);
  const { weekendWork, toggleWeekendWork, compUsed, compEarned, compRemaining } = useWorkCheck();

  const workSet = useMemo(() => new Set(weekendWork), [weekendWork]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, { name: string; kind: NonNullable<ReturnType<typeof KIND_BY_ID.get>> }[]>();
    for (const r of LEAVE_RECORDS) {
      const kind = KIND_BY_ID.get(r.kind);
      const name = NAME_BY_ID.get(r.employeeId);
      if (!kind || !name) continue;
      map.set(r.date, [...(map.get(r.date) ?? []), { name, kind }]);
    }
    const compKind = KIND_BY_ID.get('comp');
    if (compKind) {
      for (const r of compUsed) {
        map.set(r.date, [...(map.get(r.date) ?? []), { name: NAME_BY_ID.get(r.employeeId) ?? ME.name, kind: compKind }]);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.kind.order - b.kind.order);
    return map;
  }, [compUsed]);

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const move = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  return (
    <div className="flex w-full flex-col items-start gap-[12px]">
      <div className="flex w-full items-center gap-[12px]">
        <h2 className="m-0 whitespace-nowrap text-lg font-semibold text-fg">휴가 캘린더</h2>
        <div className="flex items-center gap-[4px]">
          <button type="button" aria-label="이전 달" onClick={() => move(-1)} className="flex size-[24px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-secondary hover:bg-surface-sunken">
            ‹
          </button>
          <span className="min-w-[72px] whitespace-nowrap text-center text-base font-medium text-fg">
            {year}년 {month}월
          </span>
          <button type="button" aria-label="다음 달" onClick={() => move(1)} className="flex size-[24px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-secondary hover:bg-surface-sunken">
            ›
          </button>
        </div>
        <div className="h-px min-w-px flex-1" />
        <div className="flex items-center gap-[8px]">
          <span className="flex items-center gap-[4px] whitespace-nowrap rounded-md bg-info-bg px-[8px] py-[3px] text-2xs font-medium text-brand-blue">
            <img alt="" src="/assets/leave/work.svg" className="size-[14px]" />
            주말 근무 {compEarned}일
          </span>
          <span className="flex items-center gap-[4px] whitespace-nowrap rounded-md bg-surface-sunken px-[8px] py-[3px] text-2xs font-medium text-fg-secondary">
            <img alt="" src="/assets/leave/comp.svg" className="size-[14px]" />
            대휴 잔여 {compRemaining}일
          </span>
        </div>
        <div className="flex items-center gap-[12px]">
          {LEAVE_KINDS.map((k) => (
            <span key={k.kind} className="flex items-center gap-[4px] whitespace-nowrap text-2xs text-fg-secondary">
              <img alt="" src={k.icon} className="size-[14px]" />
              {k.label}
            </span>
          ))}
          <span className="flex items-center gap-[4px] whitespace-nowrap text-2xs text-fg-secondary">
            <img alt="" src="/assets/leave/work.svg" className="size-[14px]" />
            주말 근무
          </span>
        </div>
      </div>

      <div className="grid w-full grid-cols-7 overflow-hidden rounded-lg border border-solid border-border">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`flex h-[32px] items-center justify-center border-b border-solid border-border bg-surface-sunken text-2xs font-semibold ${i === 0 ? 'text-error' : 'text-fg-tertiary'}`}>
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          const key = day ? `${year}-${pad(month)}-${pad(day)}` : '';
          const list = day ? (recordsByDate.get(key) ?? []) : [];
          const isToday = key === LEAVE_TODAY;
          const isWeekendCell = day !== null && (i % 7 === 0 || i % 7 === 6);
          const worked = isWeekendCell && workSet.has(key);
          return (
            <div
              key={i}
              onClick={day ? (isWeekendCell ? () => toggleWeekendWork(key) : () => router.push(`/leave/request?date=${key}`)) : undefined}
              aria-pressed={isWeekendCell ? worked : undefined}
              title={day ? (isWeekendCell ? `${ME.name} · 주말 근무 체크` : `${month}월 ${day}일 휴무계 작성`) : undefined}
              className={`flex min-h-[96px] flex-col items-start gap-[4px] border-solid border-border p-[6px] ${i % 7 !== 6 ? 'border-r' : ''} ${i < cells.length - 7 ? 'border-b' : ''} ${day ? '' : 'bg-surface-sunken'} ${day ? 'cursor-pointer hover:bg-surface-sunken' : ''}`}
            >
              {day ? (
                <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[4px] text-2xs font-medium ${isToday ? 'bg-brand text-white' : i % 7 === 0 ? 'text-error' : 'text-fg-secondary'}`}>
                  {day}
                </span>
              ) : null}
              {worked ? (
                <span title={`${ME.name} · 주말 근무`} className="flex w-full items-center gap-[4px] text-2xs font-medium text-brand-blue">
                  <img alt="주말 근무" src="/assets/leave/work.svg" className="size-[14px] shrink-0" />
                  <span className="min-w-px flex-1 truncate">근무</span>
                </span>
              ) : null}
              {list.map((r, ri) => (
                <span key={ri} title={`${r.name} · ${r.kind.label}`} className="flex w-full items-center gap-[4px] text-2xs text-fg">
                  <img alt={r.kind.label} src={r.kind.icon} className="size-[14px] shrink-0" />
                  <span className="min-w-px flex-1 truncate">{r.name}</span>
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
