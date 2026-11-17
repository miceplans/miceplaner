'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DatePicker, FlowTopbar, PageFrame, Select, Textarea, toast } from '@miceplans/ui';
import { LEAVE_ME, LEAVE_EMPLOYEES, LEAVE_KINDS, LEAVE_TODAY, remainingOf, type LeaveKind } from '../data';
import { useWorkCheck } from '../use-work-check';

/** 로그인 사용자 연동 전까지는 빈 값(LEAVE_ME)으로 둔다. */
const ME = LEAVE_EMPLOYEES[0] ?? LEAVE_ME;
const COLLEAGUES = LEAVE_EMPLOYEES.filter((e) => e.id !== ME.id);

const field = 'w-full';

const label = 'text-sm font-medium text-fg';

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

/** 시작~종료일의 평일 수. */
function weekdaysBetween(start: string, end: string): number {
  return weekdayDatesBetween(start, end).length;
}

/** 시작~종료일의 평일 날짜 목록(YYYY-MM-DD). */
function weekdayDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }
  return dates;
}

export function LeaveRequestView() {
  const dateParam = useSearchParams().get('date');
  const initialDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : LEAVE_TODAY;
  const [kind, setKind] = useState<LeaveKind>('full');
  const [start, setStart] = useState(initialDate);
  const [end, setEnd] = useState(initialDate);
  const [reason, setReason] = useState('');
  const [substitute, setSubstitute] = useState('');
  const [sent, setSent] = useState(false);
  const [submittedDays, setSubmittedDays] = useState(0);
  const { compEarned, compUsedDays, compRemaining, addCompUsed } = useWorkCheck();

  const isComp = kind === 'comp';
  const perDay = LEAVE_KINDS.find((k) => k.kind === kind)?.days ?? 1;
  const multiDay = perDay === 1;
  const days = multiDay ? weekdaysBetween(start, end) : perDay;
  const remaining = isComp ? compRemaining : remainingOf(ME) - submittedDays;
  const error =
    days <= 0
      ? '[400] 사용 일수가 0일입니다. 날짜를 확인해 주세요.'
      : isComp && compEarned === 0
        ? '[400] 주말 근무를 체크하면 대휴 1일이 발생합니다.'
        : days > remaining
          ? isComp
            ? '[400] 잔여 대휴를 초과했습니다.'
            : '[400] 잔여 연차를 초과했습니다.'
          : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) {
      toast.error(error);
      return;
    }
    if (isComp) {
      addCompUsed(weekdayDatesBetween(start, end).map((date) => ({ date, employeeId: ME.id, kind: 'comp' as const })));
    } else {
      setSubmittedDays(submittedDays + days);
    }
    setSent(true);
    setReason('');
    setSubstitute('');
  };

  const usableDays = isComp ? compEarned : ME.total;
  const usedDays = isComp ? compUsedDays : ME.total - remaining;
  const usedRate = usableDays > 0 ? Math.min(100, (usedDays / usableDays) * 100) : 0;

  return (
    <PageFrame topbar={<FlowTopbar showToggle title="휴무계" />} mainClassName="bg-surface">
      <div className="flex min-h-px flex-1 flex-col items-center overflow-auto px-[24px] py-[48px]">
        <form onSubmit={submit} className="flex w-full max-w-[520px] flex-col gap-[28px]">
          <div className="flex flex-col gap-[6px]">
            <h2 className="m-0 text-2xl font-semibold text-fg">휴무계</h2>
            <p className="m-0 text-base text-fg-secondary">{ME.name} · {ME.role}</p>
          </div>

          <div className="flex flex-col gap-[12px] rounded-xl bg-surface-sunken p-[20px]">
            <div className="flex items-end justify-between">
              <span className="text-sm text-fg-secondary">{isComp ? '남은 대휴' : '남은 연차'}</span>
              <span className="text-2xl font-semibold leading-none text-fg">
                {formatDays(remaining)}일 <span className="text-base font-normal text-fg-tertiary">/ {formatDays(usableDays)}일</span>
              </span>
            </div>
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-surface-chip">
              <div className="h-full rounded-full bg-fg" style={{ width: `${usedRate}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-[8px]">
            <span className={label}>휴가 형태</span>
            <Select
              size="lg"
              className={field}
              value={kind}
              onChange={(e) => setKind(e.target.value as LeaveKind)}
              options={LEAVE_KINDS.map((k) => ({ value: k.kind, label: `${k.label} (${formatDays(k.days)}일)` }))}
            />
          </div>

          <div className="flex flex-col gap-[8px]">
            <span className={label}>사용 기간</span>
            <div className="flex items-center gap-[8px]">
              <DatePicker size="lg" aria-label="시작일" value={start} onChange={(v) => { setStart(v); if (v > end) setEnd(v); }} className={field} />
              {multiDay ? (
                <>
                  <span className="text-fg-tertiary">~</span>
                  <DatePicker size="lg" aria-label="종료일" value={end} min={start} onChange={setEnd} className={field} />
                </>
              ) : null}
            </div>
            <p className="m-0 text-sm text-fg-secondary">총 {formatDays(days)}일 사용</p>
          </div>

          <label className="flex flex-col gap-[8px]">
            <span className={label}>사유</span>
            <Textarea size="lg" required rows={4} value={reason} onChange={(e) => { setReason(e.target.value); setSent(false); }} placeholder="사유를 입력해 주세요" className={field} />
          </label>

          <div className="flex flex-col gap-[8px]">
            <span className={label}>대체 근무자 <span className="font-normal text-fg-tertiary">(선택)</span></span>
            <Select
              size="lg"
              className={field}
              value={substitute}
              onChange={(e) => setSubstitute(e.target.value)}
              options={[{ value: '', label: '지정 안 함' }, ...COLLEAGUES.map((c) => ({ value: c.name, label: `${c.name} · ${c.role}` }))]}
            />
          </div>

          <div className="flex flex-col gap-[8px]">
            <button type="submit" className="h-[44px] w-full rounded-lg bg-fg text-base font-medium text-surface">
              제출
            </button>
            {sent ? <p className="m-0 text-center text-sm text-fg-secondary">제출되었습니다.</p> : null}
          </div>
        </form>
      </div>
    </PageFrame>
  );
}
