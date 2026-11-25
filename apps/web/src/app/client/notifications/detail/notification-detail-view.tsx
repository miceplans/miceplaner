'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ClientHeader } from '@miceplans/ui';
import type { PortalNotificationDto, PortalProgramDto } from '@miceplans/contracts/portal';
import { getPortalNotificationsQueryKey, usePortalMarkNotificationsRead, usePortalNotifications, usePortalPrograms } from '../../../../lib/api/generated/endpoints';
import { programState, todayIso, type ScheduleState } from '../../portal';
import { eventDetailHref } from '../../use-portal-data';
import { KindIcon } from '../kind-icon';
import { detailTime, KIND_LABEL, notificationBody, notificationMonth, notificationTitle, scheduleChange } from '../notification-model';
import { ProgramCalendar } from './program-calendar';

const A = '/assets/client/inbox-detail';

const CARD = 'flex w-full flex-col gap-[12px] rounded-lg border border-solid border-border bg-surface p-[16px]';

const KIND_TONE: Record<PortalNotificationDto['kind'], string> = {
  schedule_changed: 'bg-notice-bg text-notice',
  program_published: 'bg-surface-section text-fg-secondary',
};

const STATE_TONE: Record<ScheduleState, string> = {
  예정: 'bg-notice-bg text-notice',
  진행중: 'bg-ongoing-bg text-scheduled',
  완료: 'bg-surface-chip text-fg-secondary',
};

/** 최근 활동을 몇 건까지 보일지. */
const ACTIVITY_COUNT = 5;

/** Client 알림 상세 (Figma 221:27009). 담당자·변경한 사람은 Client에게 노출하지 않아 두지 않는다 (명세 F-07). */
export function ClientNotificationDetailView() {
  const id = Number(useSearchParams().get('id'));
  const query = usePortalNotifications();
  const programs = usePortalPrograms();
  const notification = query.data?.find((n) => n.id === id) ?? null;
  const opened = useOpenedUnread(notification);

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active="notifications" />
      <main className="flex min-h-px w-full flex-1 flex-col">
        <div className="flex h-[52px] w-full shrink-0 items-center gap-[10px] border-b border-solid border-border px-[24px] max-md:px-[16px]">
          <a href="/client/notifications" className="flex h-[28px] shrink-0 items-center gap-[6px]">
            <img alt="" src={`${A}/back.svg`} className="size-[15px]" />
            <span className="whitespace-nowrap text-base font-medium text-fg-secondary">알림함</span>
          </a>
          <img alt="" src={`${A}/crumb.svg`} className="size-[13px]" />
          <h1 className="whitespace-nowrap text-md font-semibold text-fg">알림 상세</h1>
          <span className="min-w-px flex-1" />
          {opened ? (
            <span className="flex h-[22px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-full bg-unread-bg px-[9px] text-2xs font-medium text-unread">
              <img alt="" src={`${A}/chip-dot.svg`} className="size-[6px]" />
              안 읽은 알림
            </span>
          ) : null}
        </div>
        {query.isError ? (
          <p role="alert" className="flex h-[160px] items-center justify-center text-sm text-error-delay">{query.error instanceof Error && query.error.message ? query.error.message : '알림을 불러오지 못했습니다.'}</p>
        ) : !query.data ? (
          <p className="flex h-[160px] items-center justify-center text-sm text-fg-tertiary">불러오는 중…</p>
        ) : !notification ? (
          <p className="flex h-[160px] items-center justify-center text-sm text-fg-tertiary">알림을 찾을 수 없습니다</p>
        ) : (
          <Detail notification={notification} unread={opened} all={query.data} programs={programs.data ?? []} />
        )}
      </main>
    </div>
  );
}

/** 안 읽은 알림을 열면 한 번 읽음 처리하고, 이 화면에 있는 동안은 안 읽은 알림이었음을 계속 표시한다. */
function useOpenedUnread(notification: PortalNotificationDto | null): boolean {
  const client = useQueryClient();
  const { mutate } = usePortalMarkNotificationsRead();
  const requested = useRef<number | null>(null);
  const [openedId, setOpenedId] = useState<number | null>(null);
  const unreadId = notification && notification.readAt === null ? notification.id : null;

  useEffect(() => {
    if (unreadId === null || requested.current === unreadId) return;
    requested.current = unreadId;
    setOpenedId(unreadId);
    mutate({ data: { ids: [unreadId] } }, { onSuccess: () => client.invalidateQueries({ queryKey: getPortalNotificationsQueryKey() }) });
  }, [unreadId, mutate, client]);

  return notification !== null && (unreadId !== null || openedId === notification.id);
}

function Detail({ notification: n, unread, all, programs }: { notification: PortalNotificationDto; unread: boolean; all: PortalNotificationDto[]; programs: PortalProgramDto[] }) {
  const now = new Date();
  const program = programs.find((p) => p.programId === n.programId);
  const state = program ? programState(program.startsOn, program.dueOn, todayIso(now)) : null;
  const change = n.kind === 'schedule_changed' ? scheduleChange(n) : null;
  const { year, month } = notificationMonth(n, now);
  const activity = all.filter((a) => a.programId === n.programId).slice(0, ACTIVITY_COUNT).reverse();

  return (
    <div className="flex w-full flex-1 items-start gap-[20px] px-[24px] py-[16px] max-lg:flex-col max-md:px-[16px]">
      <div className="flex w-[320px] shrink-0 flex-col gap-[14px] max-lg:w-full">
        <article className={CARD}>
          <div className="flex w-full items-center gap-[8px]">
            <KindIcon kind={n.kind} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[4px]">
              <span className={`flex h-[20px] items-center gap-[5px] rounded-full px-[8px] text-2xs font-medium ${KIND_TONE[n.kind]}`}>
                <span aria-hidden className="size-[5px] rounded-full bg-current" />
                {KIND_LABEL[n.kind]}
              </span>
              <span className="text-2xs leading-[1.2] text-fg-tertiary">{detailTime(n.createdAt, now)}</span>
            </div>
            {unread ? <img alt="" src={`${A}/unread.svg`} className="size-[7px] shrink-0" /> : null}
          </div>
          <h2 className="break-keep break-words text-title font-semibold leading-[1.45] text-fg">{notificationTitle(n)}</h2>
          <p className="break-keep text-sm leading-[1.55] text-fg-secondary">{notificationBody(n)}</p>
          {change ? (
            <>
              <div className="h-px w-full bg-border" />
              <dl className="flex w-full flex-col gap-[8px]">
                <ChangeRow label={`이전 ${change.label}`} value={change.beforeChip} tone="bg-surface-section font-medium text-fg-secondary" />
                <img alt="" src={`${A}/arrow.svg`} className="size-[14px] self-center" />
                <ChangeRow label={`변경 ${change.label}`} value={change.afterChip} tone="bg-notice-bg font-semibold text-notice" />
              </dl>
            </>
          ) : null}
        </article>

        <section className={CARD}>
          <h2 className="text-2xs font-medium leading-[1.2] tracking-[0.8px] text-fg-tertiary">연결 정보</h2>
          <dl className="flex w-full flex-col gap-[12px]">
            <InfoRow label="행사"><span className="truncate text-base font-medium leading-[1.2] text-fg">{n.eventName}</span></InfoRow>
            <InfoRow label="일정"><span className="truncate text-base leading-[1.2] text-fg">{n.programTitle}</span></InfoRow>
            {state ? (
              <InfoRow label="상태">
                <span className={`flex h-[22px] items-center gap-[5px] rounded-full px-[9px] text-xs font-medium ${STATE_TONE[state]}`}>
                  <span aria-hidden className="size-[6px] rounded-full bg-current" />
                  {state}
                </span>
              </InfoRow>
            ) : null}
          </dl>
        </section>

        <section className={CARD}>
          <h2 className="text-base font-semibold leading-[1.2] text-fg">활동 기록</h2>
          <ul className="flex w-full flex-col gap-[12px]">
            {activity.map((a) => (
              <li key={a.id} className="flex w-full items-center gap-[9px]">
                <img alt="" src={`${A}/${a.kind === 'schedule_changed' ? 'act' : 'act2'}.svg`} className="size-[7px] shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm leading-[1.2] text-fg">{a.kind === 'schedule_changed' ? `${scheduleChange(a).label}이 변경됐어요` : '일정이 공유됐어요'}</span>
                <span className="shrink-0 whitespace-nowrap text-2xs leading-[1.2] text-fg-tertiary">{detailTime(a.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="flex w-full min-w-0 flex-1 flex-col gap-[8px]">
        <div className="flex min-h-[20px] w-full flex-wrap items-center gap-[8px] px-[4px] py-[2px]">
          <img alt="" src={`${A}/caption.svg`} className="size-[14px]" />
          <h2 className="whitespace-nowrap text-base font-semibold leading-[1.2] text-fg">연계 캘린더</h2>
          <p className="text-xs leading-[1.2] text-fg-tertiary">{n.eventName}의 {year}년 {month}월 일정이 그대로 표시돼요</p>
          <span className="min-w-px flex-1" />
          <a href={eventDetailHref(n.eventId)} className="flex shrink-0 items-center gap-[8px]">
            <span className="whitespace-nowrap text-xs font-medium leading-[1.2] text-ai">행사에서 보기</span>
            <img alt="" src={`${A}/link.svg`} className="size-[13px]" />
          </a>
        </div>
        <ProgramCalendar programs={programs.filter((p) => p.eventId === n.eventId)} year={year} month={month} highlightId={n.programId} />
      </section>
    </div>
  );
}

function ChangeRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-[8px]">
      <dt className="whitespace-nowrap text-xs leading-[1.2] text-fg-tertiary">{label}</dt>
      <dd className={`flex h-[24px] items-center justify-center whitespace-nowrap rounded-sm px-[10px] text-sm ${tone}`}>{value}</dd>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-[10px]">
      <dt className="shrink-0 text-xs leading-[1.2] text-fg-tertiary">{label}</dt>
      <dd className="flex min-w-0">{children}</dd>
    </div>
  );
}
