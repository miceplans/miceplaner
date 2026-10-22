import { FlowTopbar, PageFrame } from '@miceplans/ui';
import { LEAVE_EMPLOYEES, LOW_REMAINING_DAYS, MONTH_LABELS, remainingOf, usageRateOf } from './data';

const SHADOW = 'shadow-card';

const AVATAR_BG = ['bg-brand-tint text-brand', 'bg-notice-bg text-notice', 'bg-success-bg text-success-deep', 'bg-info-bg text-brand-blue', 'bg-surface-chip text-fg-secondary'];

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function LeaveView() {
  const employees = LEAVE_EMPLOYEES;
  const totalCount = employees.length;
  const avgRemaining = employees.reduce((sum, e) => sum + remainingOf(e), 0) / totalCount;
  const avgUsageRate = employees.reduce((sum, e) => sum + usageRateOf(e), 0) / totalCount;
  const lowRemainingCount = employees.filter((e) => remainingOf(e) <= LOW_REMAINING_DAYS).length;

  return (
    <PageFrame topbar={<FlowTopbar showToggle title="연차 사용 현황" />} mainClassName="bg-surface">
      <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] px-[24px] py-[20px]">
        <div className="flex w-full items-start gap-[12px]">
          <div className={`flex h-[76px] min-w-px flex-1 flex-col justify-center gap-[6px] rounded-lg bg-surface px-[14px] ${SHADOW}`}>
            <span className="whitespace-nowrap text-2xs text-fg-tertiary">전체 직원</span>
            <span className="whitespace-nowrap text-xl font-semibold text-fg">{totalCount}명</span>
          </div>
          <div className={`flex h-[76px] min-w-px flex-1 flex-col justify-center gap-[6px] rounded-lg bg-surface px-[14px] ${SHADOW}`}>
            <span className="whitespace-nowrap text-2xs text-fg-tertiary">평균 잔여 연차</span>
            <div className="flex items-end gap-[5px]">
              <span className="text-xl font-semibold leading-[97.22%] text-fg">{avgRemaining.toFixed(1)}일</span>
              <span className="whitespace-nowrap text-2xs text-fg-tertiary">/ 전체 인원 기준</span>
            </div>
          </div>
          <div className={`flex h-[76px] min-w-px flex-1 flex-col justify-center gap-[6px] rounded-lg bg-surface px-[14px] ${SHADOW}`}>
            <span className="whitespace-nowrap text-2xs text-fg-tertiary">평균 사용률</span>
            <span className="whitespace-nowrap text-xl font-semibold text-fg">{Math.round(avgUsageRate * 100)}%</span>
          </div>
          <div className={`flex h-[76px] min-w-px flex-1 flex-col justify-center gap-[6px] rounded-lg bg-surface px-[14px] ${SHADOW}`}>
            <span className="whitespace-nowrap text-2xs text-fg-tertiary">잔여 {LOW_REMAINING_DAYS}일 이하</span>
            <div className="flex items-end gap-[5px]">
              <span className={`text-xl font-semibold leading-[97.22%] ${lowRemainingCount > 0 ? 'text-error' : 'text-fg'}`}>{lowRemainingCount}명</span>
              {lowRemainingCount > 0 ? <span className="whitespace-nowrap text-2xs text-error">관리 필요</span> : null}
            </div>
          </div>
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
                <div className="flex h-[48px] w-[140px] shrink-0 items-center gap-[8px]">
                  <span className={`flex size-[24px] items-center justify-center rounded-md text-2xs font-semibold ${AVATAR_BG[i % AVATAR_BG.length]}`}>
                    {e.name.charAt(0)}
                  </span>
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
        <p className="m-0 text-2xs text-fg-tertiary">잔여 연차가 {LOW_REMAINING_DAYS}일 이하인 직원은 빨간색으로 표시됩니다. 목업 데이터 기준: 2026년 10월 현재.</p>
      </div>
    </PageFrame>
  );
}
