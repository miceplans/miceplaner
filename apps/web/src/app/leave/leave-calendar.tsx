'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button, ConfirmDialog, Dialog, toast } from '@miceplans/ui';
import { getToken } from '../../lib/api';
import { LEAVE_KINDS, LEAVE_TODAY, type LeaveEmployee } from './data';
import { leaveErrorText, useRefreshLeave, useWorkCheck } from './use-work-check';
import { useDirectoryUsers, useLeaveCancel, useLeaveList } from '../../lib/api/generated/endpoints';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const KIND_BY_ID = new Map(LEAVE_KINDS.map((k, i) => [k.kind, { ...k, order: i }]));

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

type Entry = { id: string; mine: boolean; date: string; name: string; kind: NonNullable<ReturnType<typeof KIND_BY_ID.get>>; reason: string; substitute: string };

const entryLabel = (e: Entry) => `${Number(e.date.slice(5, 7))}월 ${Number(e.date.slice(8))}일 ${e.kind.label}`;

/** 휴가 상세. 사유와 대체 근무자는 내부 직원 전원이 보고, 취소는 본인만 한다 (명세 F-12). */
function LeaveDetail({ entry, onClose, onCancelLeave }: { entry: Entry; onClose: () => void; onCancelLeave: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Dialog onClose={onClose}>
      <div role="dialog" aria-label="휴가 상세" onClick={(e) => e.stopPropagation()} className="flex w-[360px] max-w-full flex-col gap-[16px] rounded-lg bg-surface p-[20px] shadow-card">
        <div className="flex flex-col gap-[4px]">
          <h2 className="m-0 text-lg font-semibold text-fg">{entry.name}</h2>
          <p className="m-0 text-base text-fg-secondary">{entryLabel(entry)}</p>
        </div>
        <dl className="m-0 flex flex-col gap-[10px] text-base">
          <div className="flex flex-col gap-[2px]">
            <dt className="text-sm text-fg-tertiary">사유</dt>
            <dd className="m-0 whitespace-pre-wrap break-words text-fg">{entry.reason || '-'}</dd>
          </div>
          <div className="flex flex-col gap-[2px]">
            <dt className="text-sm text-fg-tertiary">대체 근무자</dt>
            <dd className="m-0 text-fg">{entry.substitute || '지정 안 함'}</dd>
          </div>
        </dl>
        <div className="flex justify-end gap-[8px]">
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          {entry.mine && <Button className="bg-error-delay text-fg-inverse" onClick={onCancelLeave}>신청 취소</Button>}
        </div>
      </div>
    </Dialog>
  );
}

export function LeaveCalendar({ employees, me }: { employees: LeaveEmployee[]; me: LeaveEmployee }) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { weekendWork, toggleWeekendWork } = useWorkCheck();
  const { compEarned } = me;
  const compRemaining = me.compEarned - me.compUsed;
  const refresh = useRefreshLeave();
  const cancelLeave = useLeaveCancel();
  const [canceling, setCanceling] = useState<Entry | null>(null);
  const [detail, setDetail] = useState<Entry | null>(null);
  const users = useDirectoryUsers({ query: { enabled: getToken() !== null, staleTime: 60_000 } });
  const userNameById = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u.name])), [users.data]);
  const leaveList = useLeaveList({ year, month });

  const workSet = useMemo(() => new Set(weekendWork), [weekendWork]);
  const nameById = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const r of leaveList.data ?? []) {
      const kind = KIND_BY_ID.get(r.kind);
      const name = nameById.get(r.userId);
      if (!kind || !name) continue;
      map.set(r.date, [...(map.get(r.date) ?? []), { id: r.id, mine: r.userId === me.id, date: r.date, name, kind, reason: r.reason, substitute: r.substituteId ? (userNameById.get(r.substituteId) ?? nameById.get(r.substituteId) ?? '알 수 없음') : '' }]);
    }
    for (const list of map.values()) list.sort((a, b) => a.kind.order - b.kind.order);
    return map;
  }, [leaveList.data, nameById, userNameById, me.id]);

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
              title={day ? (isWeekendCell ? `${me.name} · 주말 근무 체크` : `${month}월 ${day}일 휴무계 작성`) : undefined}
              className={`flex min-h-[96px] flex-col items-start gap-[4px] border-solid border-border p-[6px] ${i % 7 !== 6 ? 'border-r' : ''} ${i < cells.length - 7 ? 'border-b' : ''} ${day ? '' : 'bg-surface-sunken'} ${day ? 'cursor-pointer hover:bg-surface-sunken' : ''}`}
            >
              {day ? (
                <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[4px] text-2xs font-medium ${isToday ? 'bg-brand text-white' : i % 7 === 0 ? 'text-error' : 'text-fg-secondary'}`}>
                  {day}
                </span>
              ) : null}
              {worked ? (
                <span title={`${me.name} · 주말 근무`} className="flex w-full items-center gap-[4px] text-2xs font-medium text-brand-blue">
                  <img alt="주말 근무" src="/assets/leave/work.svg" className="size-[14px] shrink-0" />
                  <span className="min-w-px flex-1 truncate">근무</span>
                </span>
              ) : null}
              {list.map((r) => {
                const body = (
                  <>
                    <img alt={r.kind.label} src={r.kind.icon} className="size-[14px] shrink-0" />
                    <span className="min-w-px flex-1 truncate text-left">{r.name}</span>
                  </>
                );
                return (
                  <button
                    key={r.id}
                    type="button"
                    title={`${r.name} · ${r.kind.label} · 누르면 상세`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetail(r);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-[4px] rounded-sm border-0 bg-transparent p-0 text-2xs text-fg hover:bg-surface-chip ${r.mine ? 'font-medium' : ''}`}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {detail && (
        <LeaveDetail
          entry={detail}
          onClose={() => setDetail(null)}
          onCancelLeave={() => {
            setCanceling(detail);
            setDetail(null);
          }}
        />
      )}
      {canceling && (
        <ConfirmDialog
          title={`${entryLabel(canceling)} 신청을 취소할까요?`}
          body="취소하면 사용 일수에서 빠집니다."
          confirmLabel="신청 취소"
          cancelLabel="닫기"
          onClose={() => setCanceling(null)}
          onConfirm={() => {
            cancelLeave.mutate(
              { id: canceling.id },
              { onSuccess: refresh, onError: (error) => toast.error(leaveErrorText(error, '[500] 신청을 취소하지 못했습니다.')) },
            );
            setCanceling(null);
          }}
        />
      )}
    </div>
  );
}
