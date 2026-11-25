'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BackLink, DatePicker, FlowTopbar, PageFrame, Select, toast } from '@miceplans/ui';
import { LEAVE_KINDS, LEAVE_TODAY, LEAVE_ME, remainingOf, type LeaveEmployee, type LeaveKind } from '../data';
import { leaveErrorText, useRefreshLeave } from '../use-work-check';
import { getToken } from '../../../lib/api';
import { useGetMe, useLeaveBalances, useLeaveRequest } from '../../../lib/api/generated/endpoints';

const field = 'w-full';

const label = 'text-sm font-medium text-fg';

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
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
  const [sent, setSent] = useState(false);
  const request = useLeaveRequest();
  const refresh = useRefreshLeave();

  // 로그인 사용자의 잔여일은 쓰려는 날짜의 연도 기준으로 연차 API에서 가져온다.
  const year = Number(start.slice(0, 4));
  const balances = useLeaveBalances({ year });
  const meQuery = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const employees: LeaveEmployee[] = (balances.data ?? []).map((b) => ({
    id: b.userId,
    name: b.name,
    role: b.jobTitle,
    total: b.total,
    used: b.used,
    monthly: b.monthly,
    compEarned: b.compEarned,
    compUsed: b.compUsed,
  }));
  const found = employees.find((e) => e.id === meQuery.data?.id);
  const ME = found ?? LEAVE_ME;

  const isComp = kind === 'comp';
  const perDay = LEAVE_KINDS.find((k) => k.kind === kind)?.days ?? 1;
  const multiDay = perDay === 1;
  // 날짜 범위를 도는 계산은 입력이 바뀔 때만 실행한다.
  const dates = useMemo(() => weekdayDatesBetween(start, multiDay ? end : start), [multiDay, start, end]);
  const days = dates.length * perDay;
  const remaining = isComp ? ME.compEarned - ME.compUsed : remainingOf(ME);
  const error = useMemo(() => {
    if (days <= 0) return '[400] 사용 일수가 0일입니다. 주말에는 신청할 수 없으니 날짜를 확인해 주세요.';
    // 대휴 한도는 연도를 넘겨 누적되므로 올해 값만 아는 화면에서는 막지 않고 서버가 판정한다.
    if (found && !isComp && days > remaining) return '[400] 잔여 연차를 초과했습니다.';
    return null;
  }, [days, found, isComp, remaining]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) {
      toast.error(error);
      return;
    }
    if (request.isPending) return;
    // 서버는 시작·종료일이 평일이어야 받으므로 기간 앞뒤의 주말을 뺀다.
    request.mutate(
      { data: { kind, startDate: dates[0]!, endDate: dates.at(-1)! } },
      {
        onSuccess: () => {
          setSent(true);
          refresh();
        },
        onError: (err) => toast.error(leaveErrorText(err, '[500] 휴무계를 제출하지 못했습니다.')),
      },
    );
  };

  const usableDays = isComp ? ME.compEarned : ME.total;
  const usedDays = isComp ? ME.compUsed : ME.used;
  const usedRate = usableDays > 0 ? Math.min(100, (usedDays / usableDays) * 100) : 0;

  return (
    <PageFrame topbar={<FlowTopbar showToggle leading={<BackLink href="/leave" />} title="휴무계" />} mainClassName="bg-surface">
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
              onChange={(e) => { setKind(e.target.value as LeaveKind); setSent(false); }}
              options={LEAVE_KINDS.map((k) => ({ value: k.kind, label: `${k.label} (${formatDays(k.days)}일)` }))}
            />
          </div>

          <div className="flex flex-col gap-[8px]">
            <span className={label}>사용 기간</span>
            <div className="flex items-center gap-[8px]">
              <DatePicker size="lg" aria-label="시작일" value={start} onChange={(v) => { setStart(v); if (v > end) setEnd(v); setSent(false); }} className={field} />
              {multiDay ? (
                <>
                  <span className="text-fg-tertiary">~</span>
                  <DatePicker size="lg" aria-label="종료일" value={end} min={start} onChange={(v) => { setEnd(v); setSent(false); }} className={field} />
                </>
              ) : null}
            </div>
            <p className="m-0 text-sm text-fg-secondary">총 {formatDays(days)}일 사용</p>
          </div>

          <div className="flex flex-col gap-[8px]">
            <button type="submit" disabled={request.isPending || sent} className="h-[44px] w-full rounded-lg bg-fg text-base font-medium text-surface disabled:opacity-50">
              {request.isPending ? '제출 중…' : '제출'}
            </button>
            {sent ? <p className="m-0 text-center text-sm text-fg-secondary">제출되었습니다.</p> : null}
          </div>
        </form>
      </div>
    </PageFrame>
  );
}
