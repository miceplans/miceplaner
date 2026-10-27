'use client';

import { useMemo, useState } from 'react';
import { LEAVE_EMPLOYEES, LEAVE_KINDS, LEAVE_RECORDS, LEAVE_TODAY } from './data';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const KIND_BY_ID = new Map(LEAVE_KINDS.map((k, i) => [k.kind, { ...k, order: i }]));
const NAME_BY_ID = new Map(LEAVE_EMPLOYEES.map((e) => [e.id, e.name]));

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function LeaveCalendar() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, { name: string; kind: NonNullable<ReturnType<typeof KIND_BY_ID.get>> }[]>();
    for (const r of LEAVE_RECORDS) {
      const kind = KIND_BY_ID.get(r.kind);
      const name = NAME_BY_ID.get(r.employeeId);
      if (!kind || !name) continue;
      map.set(r.date, [...(map.get(r.date) ?? []), { name, kind }]);
    }
    for (const list of map.values()) list.sort((a, b) => a.kind.order - b.kind.order);
    return map;
  }, []);

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
        <div className="flex items-center gap-[12px]">
          {LEAVE_KINDS.map((k) => (
            <span key={k.kind} className="flex items-center gap-[4px] whitespace-nowrap text-2xs text-fg-secondary">
              <img alt="" src={k.icon} className="size-[14px]" />
              {k.label}
            </span>
          ))}
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
          return (
            <div
              key={i}
              className={`flex min-h-[96px] flex-col items-start gap-[4px] border-solid border-border p-[6px] ${i % 7 !== 6 ? 'border-r' : ''} ${i < cells.length - 7 ? 'border-b' : ''} ${day ? '' : 'bg-surface-sunken'}`}
            >
              {day ? (
                <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[4px] text-2xs font-medium ${isToday ? 'bg-brand text-white' : i % 7 === 0 ? 'text-error' : 'text-fg-secondary'}`}>
                  {day}
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
