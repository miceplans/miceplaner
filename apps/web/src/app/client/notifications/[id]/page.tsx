import { ClientHeader } from '@miceplans/ui';
import { GROUPS } from '../data';

const A = '/assets/client/inbox-detail';

export const dynamicParams = false;

export function generateStaticParams() {
  // output: export는 동적 경로에 최소 1개 값이 필요하다. 알림이 없으면 자리표시 경로 하나만 만든다.
  return [...GROUPS.flatMap((g) => g.rows.map((r) => r.id)), '_'].map((id) => ({ id }));
}

const INFO_LABEL = 'whitespace-nowrap text-xs text-fg-tertiary';

const ACTIVITY: { icon: string; text: string; time: string }[] = [];

export default function ClientNotificationDetailPage() {
  return (
    <div className="flex min-h-[900px] w-full min-w-[1440px] flex-col bg-surface">
      <ClientHeader active="dashboard" />
      <main className="relative flex min-h-px flex-1 flex-col items-start bg-surface-sunken">
        <div className="flex h-[52px] w-full shrink-0 items-center gap-[10px] border-b border-solid border-border px-[24px]">
          <a href="/client/notifications" className="flex h-[28px] shrink-0 items-center gap-[6px]">
            <img alt="" src={`${A}/back.svg`} className="size-[15px]" />
            <span className="whitespace-nowrap text-base font-medium text-fg-secondary">알림함</span>
          </a>
          <img alt="" src={`${A}/crumb.svg`} className="size-[13px] shrink-0" />
          <h1 className="whitespace-nowrap text-md font-semibold text-fg">알림 상세</h1>
          <div className="h-px min-w-px flex-1" />
          <span className="flex h-[22px] shrink-0 items-center gap-[6px] rounded-lg bg-info-bg px-[9px]">
            <img alt="" src={`${A}/chip-dot.svg`} className="size-[6px]" />
            <span className="whitespace-nowrap text-2xs font-medium text-brand-blue">안 읽은 알림</span>
          </span>
        </div>

        <div className="flex min-h-px w-full flex-1 items-start gap-[20px] px-[24px] py-[16px]">
          <div className="flex h-full w-[320px] shrink-0 flex-col items-start gap-[14px]">
            <section className="flex h-[298px] w-full shrink-0 flex-col items-start gap-[12px] rounded-lg border border-solid border-border bg-surface p-[16px]">
              <div className="flex w-full shrink-0 items-center justify-between">
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-notice-bg">
                  <img alt="" src={`${A}/type.svg`} className="size-[16px]" />
                </div>
                <div className="flex h-[38px] shrink-0 flex-col items-start gap-[4px]">
                  <span className="flex h-[20px] shrink-0 items-center gap-[5px] rounded-lg bg-notice-bg px-[8px]">
                    <img alt="" src={`${A}/pill-dot.svg`} className="size-[5px]" />
                    <span className="whitespace-nowrap text-2xs font-medium text-notice">일정 변경</span>
                  </span>
                  <p className="whitespace-nowrap text-2xs leading-[normal] text-fg-tertiary"></p>
                </div>
                <div className="h-px w-[173px] shrink-0" />
                <img alt="안 읽음" src={`${A}/unread.svg`} className="size-[7px] shrink-0" />
              </div>
              <p className="w-full text-lg font-semibold leading-[1.45] text-fg">
                
              </p>
              <p className="w-full text-sm leading-[1.55] text-fg-secondary">
                
              </p>
              <div className="h-px w-full shrink-0 bg-border" />
              <div className="flex w-full shrink-0 flex-col items-start gap-[8px]">
                <div className="flex w-full items-center gap-[8px]">
                  <p className={INFO_LABEL}>이전 마감</p>
                  <div className="h-px min-w-px flex-1" />
                  <span className="flex h-[24px] shrink-0 items-center justify-center rounded-sm bg-surface-section px-[10px] text-sm font-medium text-fg-secondary">
                    
                  </span>
                </div>
                <div className="flex w-full items-start justify-center">
                  <img alt="" src={`${A}/arrow.svg`} className="size-[14px] shrink-0" />
                </div>
                <div className="flex w-full items-center gap-[8px]">
                  <p className={INFO_LABEL}>변경 마감</p>
                  <div className="h-px min-w-px flex-1" />
                  <span className="flex h-[24px] shrink-0 items-center justify-center rounded-sm bg-notice-bg px-[10px] text-sm font-semibold text-notice">
                    
                  </span>
                </div>
              </div>
            </section>

            <section className="flex h-[167px] w-full shrink-0 flex-col items-start gap-[12px] rounded-lg border border-solid border-border bg-surface p-[16px]">
              <p className="whitespace-nowrap text-2xs font-medium tracking-[0.8px] text-fg-tertiary">연결 정보</p>
              <div className="flex w-full items-center gap-[10px] whitespace-nowrap leading-[normal]">
                <p className="text-xs text-fg-tertiary">행사</p>
                <p className="text-base font-medium text-fg"></p>
              </div>
              <div className="flex w-full items-center gap-[10px] whitespace-nowrap leading-[normal]">
                <p className="text-xs text-fg-tertiary">일정</p>
                <p className="text-base text-fg"></p>
              </div>
              <div className="flex w-full items-center gap-[10px]">
                <p className={INFO_LABEL}>담당자</p>
                <span className="flex size-[20px] shrink-0 items-center justify-center rounded-lg bg-ai-tint text-2xs font-semibold text-ai">
                  
                </span>
                <p className="whitespace-nowrap text-base text-fg"></p>
                <div className="h-px min-w-px flex-1" />
                <p className={INFO_LABEL}>PM</p>
              </div>
              <div className="flex w-full items-center gap-[10px]">
                <p className={INFO_LABEL}>상태</p>
                <span className="flex h-[22px] shrink-0 items-center gap-[5px] rounded-lg bg-info-bg px-[9px]">
                  <img alt="" src={`${A}/dot.svg`} className="size-[6px]" />
                  <span className="whitespace-nowrap text-xs font-medium text-brand-blue"></span>
                </span>
              </div>
            </section>

            <section className="flex h-[129px] w-full shrink-0 flex-col items-start gap-[12px] rounded-lg border border-solid border-border bg-surface p-[16px]">
              <h2 className="whitespace-nowrap text-base font-semibold text-fg">활동 기록</h2>
              {ACTIVITY.map((a) => (
                <div key={a.icon} className="flex w-full items-center gap-[9px]">
                  <img alt="" src={`${A}/${a.icon}.svg`} className="size-[7px] shrink-0" />
                  <p className="min-w-px flex-1 text-sm leading-[normal] text-fg">{a.text}</p>
                  <p className="whitespace-nowrap text-2xs leading-[normal] text-fg-tertiary">{a.time}</p>
                </div>
              ))}
            </section>
          </div>

          <div className="flex h-full min-w-px flex-1 flex-col items-start gap-[8px]">
            <div className="flex w-full shrink-0 items-center gap-[8px] px-[4px] py-[2px]">
              <img alt="" src={`${A}/caption.svg`} className="size-[14px] shrink-0" />
              <p className="whitespace-nowrap text-base font-semibold text-fg">연계 캘린더</p>
              <div className="h-px min-w-px flex-1" />
              <a href="/client/calendar" className="flex items-center gap-[8px]">
                <span className="whitespace-nowrap text-xs font-medium text-ai">캘린더에서 보기</span>
                <img alt="" src={`${A}/link.svg`} className="size-[13px]" />
              </a>
            </div>
            <div className="min-h-px w-full flex-1" />
          </div>
        </div>
      </main>
    </div>
  );
}
