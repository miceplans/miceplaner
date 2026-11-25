'use client';

import { ClientHeader } from '@miceplans/ui';
import type { PortalNotificationDto } from '@miceplans/contracts/portal';
import { usePortalNotifications } from '../../../lib/api/generated/endpoints';
import { KindIcon } from './kind-icon';
import { groupNotifications, listTime, notificationTitle } from './notification-model';

const A = '/assets/client/inbox';

const MESSAGE = 'flex h-[120px] w-full items-center justify-center rounded-lg border border-solid border-border bg-surface text-sm';

/** Client 알림함 (Figma 221:26740). 공개 Program의 공유·일정 변경만 보여 준다 (명세 F-06·F-07). */
export default function ClientNotificationsPage() {
  const query = usePortalNotifications();
  const now = new Date();
  const groups = groupNotifications(query.data ?? [], now);

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-sunken">
      <ClientHeader active="notifications" />
      <main className="flex min-h-px w-full flex-1 flex-col items-center p-[40px] max-md:px-[16px] max-md:py-[20px]">
        <div className="flex w-full max-w-[1360px] flex-col gap-[14px]">
          <h1 className="sr-only">알림함</h1>
          {query.isError ? (
            <p role="alert" className={`${MESSAGE} text-error-delay`}>{query.error instanceof Error && query.error.message ? query.error.message : '알림을 불러오지 못했습니다.'}</p>
          ) : !query.data ? (
            <p className={`${MESSAGE} text-fg-tertiary`}>불러오는 중…</p>
          ) : groups.length === 0 ? (
            <p className={`${MESSAGE} text-fg-tertiary`}>새로운 알림이 없습니다</p>
          ) : (
            groups.map((g, i) => {
              const unread = g.items.filter((n) => n.readAt === null).length;
              return (
                <section key={g.label} className="flex w-full flex-col gap-[8px]">
                  <div className="flex min-h-[18px] w-full items-center gap-[8px]">
                    <h2 className="text-base font-semibold leading-[1.2] text-fg">{g.label}</h2>
                    {i === 0 && unread > 0 ? (
                      <span className="flex h-[18px] items-center justify-center whitespace-nowrap rounded-full bg-ai-tint px-[7px] text-2xs font-medium text-ai">새 알림 {unread}</span>
                    ) : null}
                  </div>
                  <ul className="flex w-full flex-col overflow-hidden rounded-lg border border-solid border-border bg-surface">
                    {g.items.map((n) => (
                      <Row key={n.id} notification={n} now={now} />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
          <p className="w-full text-center text-xs leading-[1.2] text-fg-tertiary">30일이 지난 알림은 자동으로 정리돼요</p>
        </div>
      </main>
    </div>
  );
}

function Row({ notification: n, now }: { notification: PortalNotificationDto; now: Date }) {
  const unread = n.readAt === null;
  return (
    <li className="border-b border-solid border-border last:border-b-0">
      <a href={`/client/notifications/detail?id=${n.id}`} className="flex min-h-[57px] w-full items-center gap-[12px] px-[16px] py-[10px] hover:bg-surface-subtle">
        <KindIcon kind={n.kind} />
        <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <span className={`break-keep break-words text-base ${unread ? 'font-semibold text-fg' : 'text-fg-secondary'}`}>{notificationTitle(n)}</span>
          <span className="flex min-w-0 items-center gap-[7px] text-xs leading-[1.2] text-fg-tertiary">
            <span className="min-w-0 truncate text-fg-secondary">{n.eventName}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0 whitespace-nowrap">{listTime(n.createdAt, now)}</span>
          </span>
        </span>
        {unread ? <img alt="안 읽음" src={`${A}/unread.svg`} className="ml-[14px] size-[7px] shrink-0" /> : null}
      </a>
    </li>
  );
}
