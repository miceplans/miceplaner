'use client';

import { useState } from 'react';
import { AgentFab } from '@miceplans/ui';

const A = '/assets/notifications';

type Item = { id: string; title: string; time: string; unread?: boolean; mention?: boolean; invite?: boolean };
type Group = { label: string; chip?: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: '오늘',
    chip: '새 알림 3',
    items: [
      { id: 'a1', title: '[KIMES 2026] 김한나님이 댓글에서 나를 언급했어요', time: '10분 전', unread: true, mention: true },
      { id: 'a2', title: '[AI서밋 2026] 폼 API 연동 마감이 03.12 → 03.10으로 앞당겨졌어요', time: '1시간 전', unread: true },
      { id: 'a3', title: '[KIMES 2026] 브로슈어 인쇄 견적 3사 비교” 마감까지 2일 남았어요', time: '2시간 전', unread: true },
    ],
  },
  {
    label: '어제',
    items: [
      { id: 'b1', title: '[파트너스 데이] 이준호님이 “파트너스 데이”에 스태프로 초대했어요', time: '어제 오후 6:20', invite: true },
      { id: 'b2', title: '[KIMES 2026] AI가 이번 주 일정을 요약했어요', time: '어제 오후 3:05' },
    ],
  },
  {
    label: '이번 주',
    items: [
      { id: 'c1', title: '[KIMES 2026] 김한나님이 댓글에서 나를 언급했어요', time: '10분 전', mention: true },
      { id: 'c2', title: '[AI서밋 2026] 폼 API 연동 마감이 03.12 → 03.10으로 앞당겨졌어요', time: '1시간 전' },
      { id: 'c3', title: '[KIMES 2026] 브로슈어 인쇄 견적 3사 비교” 마감까지 2일 남았어요', time: '2시간 전' },
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
          <span className="whitespace-nowrap text-base font-medium text-fg">Notifications</span>
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
                  className={`flex h-full items-center gap-[7px] px-[12px] ${on ? 'border-b-2 border-solid border-ai' : ''}`}
                >
                  <img alt="" src={`${A}/${t.icon}.svg`} className="size-[15px]" />
                  <span className={`whitespace-nowrap text-base ${on ? 'font-medium text-ai' : 'text-fg-secondary'}`}>{t.label}</span>
                  <span className={`whitespace-nowrap text-xs ${on ? 'text-ai' : 'text-fg-tertiary'}`}>{t.count}</span>
                </button>
              );
            })}
          </div>
          <div className="h-px min-w-px flex-1" />
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
                  <span className="flex h-[18px] items-center justify-center whitespace-nowrap rounded-md bg-ai-tint px-[7px] text-2xs font-medium text-ai">{g.chip}</span>
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
                        <span className="whitespace-nowrap text-xs text-fg-tertiary">{it.time}</span>
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
        <AgentFab className="absolute left-[1128px] top-[772px]" />
      </div>
    </div>
  );
}
