'use client';

import { useEffect, useMemo, useState } from 'react';
import { EventTable, type EventRow } from './event-table';
import { NoticeList } from './notice-list';
import { ViewTabs, type CalCell, type ChipKey, type ViewTab } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { ScheduleViewCalendar } from './schedule-calendar/schedule-view-calendar';
import { getMe, listEvents, type Me } from '../lib/api';
import type { EventListItemDto } from '@miceplans/contracts';

const TABS: ViewTab[] = [
  { label: '전체 행사', icon: '10b86', activeIcon: '753c4', href: '/' },
  { label: '공지', icon: '/assets/sidebar/notifications.svg' },
  { label: '내 행사', icon: '10b86' },
];

const c = (d: number, ...chips: ChipKey[]): CalCell => ({ d, chips });
const B: CalCell = {};
const today = (...chips: ChipKey[]): CalCell => ({ d: 6, today: true, chips });

const WEEKS: CalCell[][] = [
  [B, B, B, B, B, B, c(1)],
  [c(2), c(3, 'invite'), c(4), c(5, 'design'), today('brochure'), c(7, 'brochure'), c(8, 'brochure')],
  [c(9, 'brochure'), c(10, 'brochure', 'ai'), c(11, 'ai'), c(12, 'ai', 'rehearsal'), c(13, 'ai', 'kimes'), c(14, 'ai', 'kimes'), c(15, 'kimes')],
  [c(16, 'kimes'), c(17), c(18), c(19), c(20), c(21), c(22)],
  [c(23), c(24, 'kimesHome'), c(25, 'kimesHome'), c(26, 'kimesHome'), c(27), c(28), c(29)],
  [c(30), c(31), c(1), c(2), c(3, 'invite'), c(4), c(5, 'design')],
  [today('brochure'), c(7, 'brochure'), c(8, 'brochure'), c(9, 'brochure'), c(10, 'brochure', 'ai'), c(11, 'ai'), c(12, 'ai', 'rehearsal')],
  [c(13, 'ai', 'kimes'), c(14, 'ai', 'kimes'), c(15, 'kimes'), c(16, 'kimes'), c(17), c(18), c(19)],
  [c(20), c(21), c(22), c(23), c(24, 'kimesHome'), c(25, 'kimesHome'), c(26, 'kimesHome')],
  [c(27), c(28), c(29), c(30), c(31), B, B],
];

const WORK_CHIPS: Partial<Record<number, ChipKey[]>> = {
  3: ['designProduction'],
  5: ['designProduction'],
  6: ['designProduction', 'videoProduction'],
  7: ['videoProduction'],
  8: ['videoProduction'],
  9: ['videoProduction'],
  10: ['designProduction', 'videoProduction'],
  11: ['videoProduction'],
  12: ['designProduction', 'videoProduction'],
  13: ['videoProduction'],
  14: ['videoProduction'],
  15: ['videoProduction'],
  16: ['videoProduction'],
  24: ['designProduction'],
  25: ['designProduction'],
  26: ['designProduction'],
};

const WORK_WEEKS: CalCell[][] = WEEKS.map((week) =>
  week.map((cell) => (cell.d === undefined ? cell : { ...cell, chips: WORK_CHIPS[cell.d] })),
);

/** API 행사를 표 행으로 바꾼다. 아직 데이터 모델에 없는 값(디자인 담당, 예산)은 비워 둔다. */
function toRow(event: EventListItemDto): EventRow {
  return {
    id: event.id,
    name: event.name,
    color: event.color,
    startDate: event.startDate,
    endDate: event.endDate,
    priority: event.priority,
    client: event.clientName ?? '',
    pm: event.pmName ?? '',
    am: event.amName ?? '',
    design: '',
    status: event.status,
    place: event.place,
  };
}

export default function HomePage() {
  const [tab, setTab] = useState(0);
  const [events, setEvents] = useState<EventListItemDto[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    void listEvents().then(setEvents).catch(() => setEvents([]));
    void getMe().then(setMe).catch(() => undefined);
  }, []);
  const rows = useMemo(() => events.map(toRow), [events]);
  // PM·AM 이름은 다중이면 ', '로 묶여 오므로 포함 여부로 본다. 로그인 정보가 없으면 비워 둔다.
  const shown = useMemo(
    () =>
      tab === 2
        ? me
          ? rows.filter((row) => [row.pm, row.am].some((names) => names.split(',').map((s) => s.trim()).includes(me.name)))
          : []
        : rows,
    [tab, me, rows],
  );
  return (
    <AppShell active="events">
      <div className="flex min-h-screen flex-col leading-[normal]">
        <ViewTabs
          tabs={TABS}
          active={tab}
          onChange={setTab}
          bordered
          action={tab !== 1 ? <a href="/events/new" className="flex h-[32px] items-center gap-[6px] rounded-md bg-brand px-[12px] text-sm font-semibold text-fg-inverse no-underline hover:opacity-90"><span className="text-base font-normal leading-none">+</span> 행사 추가</a> : undefined}
        />
        {tab === 1 ? (
          <NoticeList />
        ) : (
          <div className="flex w-full flex-col gap-[24px]">
            <EventTable key={tab} initial={shown} />
            <ScheduleViewCalendar eventWeeks={WEEKS} workWeeks={WORK_WEEKS} gridGap={19} padX={20} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
