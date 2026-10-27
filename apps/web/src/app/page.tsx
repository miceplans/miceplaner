'use client';

import { useState } from 'react';
import { EventTable } from './event-table';
import { NoticeList } from './notice-list';
import { ViewTabs, type CalCell, type ChipKey, type StatusKey, type ViewTab } from '@miceplans/ui';
import { AppShell } from '@miceplans/ui/sidebar';
import { ScheduleViewCalendar } from './schedule-calendar/schedule-view-calendar';

const TABS: ViewTab[] = [
  { label: '전체 행사', icon: '10b86', activeIcon: '753c4', href: '/' },
  { label: '공지', icon: '/assets/sidebar/notifications.svg' },
  { label: '내 행사', icon: '10b86' },
];

const EVENTS: { id: string; name: string; dot: string; startDate: string; endDate: string; priority?: boolean; client: string; pm: string; am: string; design: string; status: StatusKey; place: string; budget?: string }[] = [
  { id: 'e1', name: '제54회 KIMES 2025', dot: 'b7f4e', startDate: '2026-03-13', endDate: '2026-03-16', priority: true, client: '메디코리아', pm: '박서연', am: '최민준', design: '이하은', status: '진행중', place: '코엑스 Hall A·B', budget: '1.2억' },
  { id: 'e2', name: '글로벌 AI 서밋 2025', dot: '175f6', startDate: '2026-11-03', endDate: '2026-11-04', priority: true, client: '테크노웨이', pm: '김도현', am: '한지우', design: '오세민', status: '성공', budget: '8,500만', place: '인터컨티넨탈 파르나스' },
  { id: 'e3', name: '삼성 파트너스 데이', dot: 'd8446', startDate: '2026-10-22', endDate: '2026-10-22', priority: true, client: '삼성전자', pm: '박서연', am: '이준호', design: '윤서준', status: '진행중', budget: '6,000만', place: '코엑스 오디토리움' },
  { id: 'e4', name: '제12회 프랜차이즈 엑스포', dot: 'ff1cc', startDate: '2026-05-08', endDate: '2026-05-10', client: '프랜차이즈협회', pm: '정유나', am: '최민준', design: '강예린', status: '제출', budget: '4,500만', place: '일산 킨텍스 Hall 1' },
  { id: 'e5', name: '현대자동차 신차 발표회', dot: 'd8446', startDate: '2026-12-15', endDate: '2026-12-15', client: '현대자동차', pm: '김도현', am: '한지우', design: '이하은', status: '보류중', budget: '9,800만', place: '잠실 롯데월드타워' },
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

export default function HomePage() {
  const [tab, setTab] = useState(0);
  const events = tab === 2 ? EVENTS.filter((event) => event.pm === '박서연' || event.am === '박서연') : EVENTS;
  return (
    <AppShell active="events">
      <div className="flex min-h-screen flex-col leading-[normal]">
        <ViewTabs tabs={TABS} active={tab} onChange={setTab} bordered />
        {tab === 1 ? (
          <NoticeList />
        ) : (
          <div className="flex w-full flex-col gap-[24px]">
            <EventTable key={tab} initial={events} />
            <ScheduleViewCalendar eventWeeks={WEEKS} workWeeks={WORK_WEEKS} gridGap={19} padX={20} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
