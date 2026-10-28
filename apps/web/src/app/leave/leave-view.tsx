import { Button, FlowTopbar, PageFrame } from '@miceplans/ui';
import { LeaveCalendar } from './leave-calendar';
import { LEAVE_EMPLOYEES, LOW_REMAINING_DAYS, MONTH_LABELS, remainingOf } from './data';

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function LeaveView() {
  const employees = LEAVE_EMPLOYEES;
  return (
    <PageFrame topbar={<FlowTopbar showToggle title="연차 사용 현황" />} mainClassName="bg-surface">
      <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] px-[24px] py-[20px]">
        <div className="flex w-full justify-end">
          <Button href="/leave/request">휴무계 작성</Button>
        </div>

        <div className="flex w-full flex-col items-start rounded-lg border border-solid border-border">
          <div className="flex h-[36px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface-sunken px-[16px] text-2xs font-semibold tracking-[0.4px] text-fg-tertiary">
            <span className="w-[140px] shrink-0">이름</span>
            <span className="w-[120px] shrink-0">직무</span>
            <span className="w-[80px] shrink-0">총 연차</span>
            <span className="w-[80px] shrink-0">사용</span>
            <span className="w-[80px] shrink-0">잔여</span>
            <span className="flex-1 whitespace-nowrap">월별 사용(1~12월)</span>
          </div>
          {employees.map((e, i) => {
            const remaining = remainingOf(e);
            const low = remaining <= LOW_REMAINING_DAYS;
            return (
              <div
                key={e.id}
                className={`flex w-full shrink-0 items-center gap-[12px] px-[16px] ${i < employees.length - 1 ? 'border-b border-solid border-border' : ''}`}
              >
                <div className="flex h-[48px] w-[140px] shrink-0 items-center">
                  <span className="whitespace-nowrap text-base font-medium text-fg">{e.name}</span>
                </div>
                <span className="w-[120px] shrink-0 whitespace-nowrap text-base text-fg-secondary">{e.role}</span>
                <span className="w-[80px] shrink-0 whitespace-nowrap text-base text-fg">{formatDays(e.total)}일</span>
                <span className="w-[80px] shrink-0 whitespace-nowrap text-base text-fg">{formatDays(e.used)}일</span>
                <span className={`w-[80px] shrink-0 whitespace-nowrap text-base font-semibold ${low ? 'text-error' : 'text-fg'}`}>
                  {formatDays(remaining)}일
                </span>
                <div className="flex flex-1 items-center gap-[4px]">
                  {MONTH_LABELS.map((m, mi) => {
                    const days = e.monthly[mi] ?? 0;
                    return (
                      <span
                        key={m}
                        title={`${m}월: ${days > 0 ? `${formatDays(days)}일 사용` : '사용 없음'}`}
                        className={`flex h-[20px] w-[22px] items-center justify-center rounded-sm text-2xs ${
                          days > 0 ? 'bg-brand-tint font-semibold text-brand' : 'bg-surface-chip text-fg-tertiary'
                        }`}
                      >
                        {days > 0 ? formatDays(days) : '·'}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <LeaveCalendar />
        <p className="m-0 text-2xs text-fg-tertiary">잔여 연차가 {LOW_REMAINING_DAYS}일 이하인 직원은 빨간색으로 표시됩니다. 목업 데이터 기준: 2026년 10월 현재.</p>
        <p className="m-0 text-2xs text-fg-tertiary">캘린더의 토·일 날짜를 누른 후 주말 근무를 체크할 수 있으며, 근무 1일당 대휴 1일이 발생해 다른 날짜에 대휴로 사용할 수 있습니다.</p>
      </div>
    </PageFrame>
  );
}
