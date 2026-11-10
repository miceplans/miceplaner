'use client';

import { useState } from 'react';
import { DesktopNotificationToggle } from '../desktop-notification-toggle';

const A = '/assets/notifications';

type Item = { id: string; title: string; time: string; at: string; unread?: boolean; mention?: boolean; invite?: boolean };
type Group = { label: string; chip?: string; items: Item[] };

// 목업 기준일('오늘'): 2026-10-22. 아래 at(절대 시각) 값의 기준이다.
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

const GROUPS: Group[] = [
  {
    label: '오늘',
    chip: '새 알림 3',
    items: [
      { id: 'a1', title: '[KIMES 2026] 김한나님이 댓글에서 나를 언급했어요', time: '10분 전', at: '2026-10-22T09:52', unread: true, mention: true },
      { id: 'a2', title: '[AI서밋 2026] 폼 API 연동 마감이 03.12 → 03.10으로 앞당겨졌어요', time: '1시간 전', at: '2026-10-22T08:45', unread: true },
      { id: 'a3', title: '[KIMES 2026] 브로슈어 인쇄 견적 3사 비교” 마감까지 2일 남았어요', time: '2시간 전', at: '2026-10-22T07:30', unread: true },
    ],
  },
  {
    label: '어제',
    items: [
      { id: 'b1', title: '[파트너스 데이] 이준호님이 “파트너스 데이”에 스태프로 초대했어요', time: '어제 오후 6:20', at: '2026-10-21T18:20', invite: true },
      { id: 'b2', title: '[KIMES 2026] AI가 이번 주 일정을 요약했어요', time: '어제 오후 3:05', at: '2026-10-21T15:05' },
    ],
  },
  {
    label: '이번 주',
    items: [
      { id: 'c1', title: '[KIMES 2026] 김한나님이 댓글에서 나를 언급했어요', time: '10분 전', at: '2026-10-22T09:40', mention: true },
      { id: 'c2', title: '[AI서밋 2026] 폼 API 연동 마감이 03.12 → 03.10으로 앞당겨졌어요', time: '1시간 전', at: '2026-10-22T08:15' },
      { id: 'c3', title: '[KIMES 2026] 브로슈어 인쇄 견적 3사 비교” 마감까지 2일 남았어요', time: '2시간 전', at: '2026-10-22T07:10' },
    ],
  },
];

const TABS = [
  { key: 'all', label: '전체', icon: 'tab-icon', count: 12 },
  { key: 'unread', label: '안읽음', icon: 'tab-icon1', count: 3 },
  { key: 'mention', label: '언급', icon: 'tab-icon2', count: 2 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function NotificationsView() {
  const [tab, setTab] = useState<TabKey>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const visible = (i: Item) => (tab === 'unread' ? i.unread && !readIds.has(i.id) : tab === 'mention' ? i.mention : true);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0);

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
            onClick={() => setReadIds(new Set(GROUPS.flatMap((g) => g.items.map((i) => i.id))))}
            className="flex h-[30px] items-center gap-[6px] rounded-sm border border-solid border-border bg-surface px-[11px]"
          >
            <img alt="" src={`${A}/mark-icon.svg`} className="size-[13px]" />
            <span className="whitespace-nowrap text-base font-medium text-fg-secondary">모두 읽음 처리</span>
          </button>
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
                          <button type="button" className="flex h-[26px] items-center justify-center rounded-sm border border-solid border-border bg-surface px-[10px] text-xs font-medium text-fg-secondary">거절</button>
                          <button type="button" className="flex h-[26px] items-center justify-center rounded-sm bg-brand px-[10px] text-xs font-medium text-fg-inverse">수락</button>
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
