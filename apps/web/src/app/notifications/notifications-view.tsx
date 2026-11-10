'use client';

import { useEffect, useState } from 'react';
import { DesktopNotificationToggle } from '../desktop-notification-toggle';
import http from '../../lib/api/http';
import { ApiError } from '../../lib/api';
import type { NotificationDto } from '@miceplans/contracts';
import { toast } from '@miceplans/ui';

const A = '/assets/notifications';

type Item = { id: string; title: string; time: string; at: string; unread?: boolean; mention?: boolean; invite?: boolean };
type Group = { label: string; chip?: string; items: Item[] };

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-10-21T18:20' → '2026.10.21 (수) 18:20' — 요일을 포함한 상세 날짜 */
function formatDetail(at: string): string {
  const [date, clock] = at.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}.${pad(m)}.${pad(d)} (${weekday}) ${pad(hh)}:${pad(mm)}`;
}

const GROUPS: Group[] = [];

const TABS = [
  { key: 'all', label: '전체', icon: 'tab-icon', count: 0 },
  { key: 'unread', label: '안읽음', icon: 'tab-icon1', count: 0 },
  { key: 'mention', label: '언급', icon: 'tab-icon2', count: 0 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function NotificationsView() {
  const [tab, setTab] = useState<TabKey>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [apiItems, setApiItems] = useState<NotificationDto[]>([]);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    void http<NotificationDto[]>('/notifications?limit=50').then(setApiItems).catch(() => {
      // API 미설정인 정적 목업은 빈 알림 상태를 유지한다.
    });
  }, []);

  const applicationIdOf = (title: string) => title.match(/\[([0-9a-f-]{36})\]$/i)?.[1];
  const approve = async (notification: NotificationDto) => {
    const applicationId = applicationIdOf(notification.title);
    if (!applicationId) return;
    setApproving(notification.id.toString());
    try {
      await http(`/auth/client-applications/${applicationId}/approve`, { method: 'POST' });
      setApiItems((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      toast.info('Client 신청을 승인했습니다.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 승인에 실패했습니다.');
    } finally {
      setApproving(null);
    }
  };

  const apiGroups: Group[] = apiItems.length ? [{ label: '최근 알림', items: apiItems.map((item) => ({
    id: item.id.toString(), title: item.title.replace(/\s*\[[0-9a-f-]{36}\]$/i, ''), time: item.kind === 'client_application' ? 'Client 가입 신청' : item.kind,
    at: item.createdAt.replace(/\.\d{3}Z$/, '').replace('Z', ''), unread: !item.readAt, invite: item.kind === 'client_application' && !item.readAt,
  })) }] : GROUPS;

  const visible = (i: Item) => (tab === 'unread' ? i.unread && !readIds.has(i.id) : tab === 'mention' ? i.mention : true);
  const groups = apiGroups.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-[900px] w-full flex-col leading-[normal]">
      <div className="flex h-[56px] shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface px-[16px]">
        <div className="flex h-full items-center">
          <span className="whitespace-nowrap text-base font-medium text-fg">알림</span>
        </div>
        <div className="h-px min-w-px flex-1" />
      </div>
      <div className="relative flex min-h-px flex-1 flex-col bg-surface">
        <div className="flex h-[52px] shrink-0 items-center gap-[10px] border-b border-solid border-border px-[24px]">
          <div className="flex h-full items-start gap-[2px]" role="tablist">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={`flex h-full items-center gap-[7px] px-[12px] ${on ? 'border-b-2 border-solid border-brand' : ''}`}
                >
                  <img alt="" src={`${A}/${t.icon}.svg`} className="size-[15px]" />
                  <span className={`whitespace-nowrap text-base ${on ? 'font-medium text-brand' : 'text-fg-secondary'}`}>{t.label}</span>
                  <span className={`whitespace-nowrap text-xs ${on ? 'text-brand' : 'text-fg-tertiary'}`}>{t.count}</span>
                </button>
              );
            })}
          </div>
          <div className="h-px min-w-px flex-1" />
          <DesktopNotificationToggle />
          <button
            type="button"
            onClick={() => setReadIds(new Set(apiGroups.flatMap((g) => g.items.map((i) => i.id))))}
            className="flex h-[30px] items-center gap-[6px] rounded-sm border border-solid border-border bg-surface px-[11px]"
          >
            <img alt="" src={`${A}/mark-icon.svg`} className="size-[13px]" />
            <span className="whitespace-nowrap text-base font-medium text-fg-secondary">모두 읽음 처리</span>
          </button>
          <DesktopNotificationToggle />
          <button type="button" aria-label="알림 설정" className="flex size-[30px] items-center justify-center rounded-sm border border-solid border-border bg-surface">
            <img alt="" src={`${A}/settings-icon.svg`} className="size-[15px]" />
          </button>
        </div>
        <div className="flex min-h-px w-full flex-1 flex-col items-start gap-[18px] px-[24px] py-[20px]">
          {groups.map((g) => (
            <div key={g.label} className="flex w-full flex-col items-start gap-[18px]">
              <div className="flex w-full items-center gap-[8px]">
                <span className="whitespace-nowrap text-base font-semibold text-fg">{g.label}</span>
                {g.chip ? (
                  <span className="flex h-[18px] items-center justify-center whitespace-nowrap rounded-md bg-brand-tint px-[7px] text-2xs font-medium text-brand">{g.chip}</span>
                ) : null}
              </div>
              <div className="flex w-full flex-col items-start rounded-lg border border-solid border-border-soft bg-surface">
                {g.items.map((it, idx) => {
                  const unread = it.unread && !readIds.has(it.id);
                  return (
                    <div
                      key={it.id}
                      className={`flex h-[62px] w-full shrink-0 items-center gap-[12px] px-[16px] py-[13px] ${idx < g.items.length - 1 ? 'border-b border-solid border-border' : ''}`}
                    >
                      <div className="flex h-full min-w-px flex-1 flex-col items-start gap-[4px]">
                        <p className="m-0 w-full text-base font-semibold leading-[1.4] text-fg">{it.title}</p>
                        <div className="flex items-center gap-[6px] whitespace-nowrap text-xs">
                          <span className="text-fg-secondary">{it.time}</span>
                          <span className="text-fg-tertiary">·</span>
                          <span className="text-fg-tertiary">{formatDetail(it.at)}</span>
                        </div>
                      </div>
                      {it.invite ? (
                        <div className="flex items-center gap-[4px]">
                          <button type="button" disabled={approving === it.id} onClick={() => {
                            const notification = apiItems.find((item) => item.id.toString() === it.id);
                            if (notification) void approve(notification);
                          }} className="flex h-[26px] items-center justify-center rounded-sm bg-brand px-[10px] text-xs font-medium text-fg-inverse disabled:opacity-50">{approving === it.id ? '승인 중…' : '승인'}</button>
                        </div>
                      ) : null}
                      {unread ? <img alt="" src={`${A}/unread-dot.svg`} className="size-[7px] shrink-0" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
