'use client';

import { useState } from 'react';
import { AppShell, MonthCalendar, StatusPill, ViewTabs, type CalCell, type ChipKey, type StatusKey, type ViewTab } from '@miceplans/ui';

const A = '/assets/schedule';

const TABS: ViewTab[] = [
  { label: '전체 행사', icon: '10b86', activeIcon: '753c4', href: '/' },
  { label: '내 행사', icon: '10b86' },
  { label: '캘린더', icon: 'b0b49', href: '/schedule-calendar' },
];

const COLS = [
  { label: '기간', icon: '7db78', w: 'w-[140px]' },
  { label: 'Client', icon: 'fe6d8', w: 'w-[130px]' },
  { label: 'PM', icon: '15302', w: 'w-[65px]' },
  { label: 'AM', icon: '15302', w: 'w-[65px]' },
  { label: '상태', icon: 'f8a2c', w: 'w-[110px]' },
] as const;

const EVENTS: { name: string; dot: string; period: string; client: string; pm: string; am: string; status: StatusKey; place: string }[] = [
  { name: '제54회 KIMES 2025', dot: 'b7f4e', period: '03.13 – 03.16', client: '메디코리아', pm: '박서연', am: '최민준', status: '진행중', place: '코엑스 Hall A·B' },
  { name: '글로벌 AI 서밋 2025', dot: '175f6', period: '04.02 – 04.03', client: '테크노웨이', pm: '김도현', am: '한지우', status: '성공', place: '인터컨티넨탈 파르나스' },
  { name: '삼성 파트너스 데이', dot: 'd8446', period: '04.18', client: '삼성전자', pm: '박서연', am: '이준호', status: '진행중', place: '코엑스 오디토리움' },
  { name: '제12회 프랜차이즈 엑스포', dot: 'ff1cc', period: '05.08 – 05.10', client: '프랜차이즈협회', pm: '정유나', am: '최민준', status: '제출', place: '일산 킨텍스 Hall 1' },
  { name: '현대자동차 신차 발표회', dot: 'd8446', period: '05.22', client: '현대자동차', pm: '김도현', am: '한지우', status: '보류중', place: '잠실 롯데월드타워' },
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

export default function HomePage() {
  const [tab, setTab] = useState(0);
  const events = tab === 1 ? EVENTS.filter((event) => event.pm === '박서연' || event.am === '박서연') : EVENTS;
  return (
    <AppShell active="events">
      <div className="flex min-h-screen flex-col leading-[normal]">
        <ViewTabs tabs={TABS} active={tab} onChange={setTab} bordered />
        <div className="flex w-full flex-col gap-[24px]">
          <div className="mobile-table-scroll flex w-full flex-col items-start bg-surface px-[20px] max-md:px-0">
            <div className="flex h-[36px] w-full shrink-0 items-start border-b border-solid border-border bg-surface text-xs font-medium text-fg-secondary">
              <div className="flex h-full w-[80px] items-center px-[30px]">
                <span className="whitespace-nowrap">우선순위</span>
              </div>
              <div className="flex h-full w-[200px] items-center px-[16px]">
                <span className="whitespace-nowrap">행사명</span>
              </div>
              {COLS.map((col) => (
                <div key={col.label} className={`flex h-full items-center gap-[6px] px-[16px] ${col.w}`}>
                  <img alt="" src={`${A}/${col.icon}.svg`} className="size-[13px]" />
                  <span className="whitespace-nowrap">{col.label}</span>
                </div>
              ))}
              <div className="flex h-full min-w-px flex-1 items-center gap-[6px] px-[16px]">
                <img alt="" src={`${A}/7bb84.svg`} className="size-[13px]" />
                <span className="whitespace-nowrap">장소</span>
              </div>
              <div className="flex h-full w-[36px] items-center justify-center">
                <img alt="" src={`${A}/204e7.svg`} className="size-[14px]" />
              </div>
            </div>
            {events.map((e, i) => (
              <div key={e.name} className="flex w-full shrink-0 items-center border-x border-b border-solid border-border px-[10px] text-base hover:bg-surface-sunken">
                <img alt="" src={`${A}/14024.svg`} className="size-[18px] shrink-0 cursor-grab" />
                <div className="flex h-[44px] min-w-px flex-1 items-start">
                  <div className="flex h-full w-[52px] items-center px-[16px] text-xs font-medium text-fg-secondary">
                    <span className="w-[45px]">{i + 1}</span>
                  </div>
                  <div className="flex h-full w-[200px] items-center gap-[4px] px-[16px] font-medium text-fg">
                    <img alt="" src={`${A}/${e.dot}.svg`} className="size-[13px] shrink-0" />
                    <span className="whitespace-nowrap">{e.name}</span>
                  </div>
                  <div className="flex h-full w-[140px] items-center px-[16px] text-fg-secondary">
                    <span className="whitespace-nowrap">{e.period}</span>
                  </div>
                  <div className="flex h-full w-[130px] items-center px-[16px] text-fg">
                    <span className="whitespace-nowrap">{e.client}</span>
                  </div>
                  <div className="flex h-full w-[65px] items-center px-[16px] text-fg">
                    <span className="whitespace-nowrap">{e.pm}</span>
                  </div>
                  <div className="flex h-full w-[65px] items-center px-[16px] text-fg">
                    <span className="whitespace-nowrap">{e.am}</span>
                  </div>
                  <div className="flex h-full w-[110px] items-center px-[16px]">
                    <StatusPill status={e.status} />
                  </div>
                  <div className="flex h-full min-w-px flex-1 items-center px-[16px] text-fg">
                    <span className="whitespace-nowrap">{e.place}</span>
                  </div>
                  <div className="h-full w-[36px] shrink-0" />
                </div>
              </div>
            ))}
          </div>
          <MonthCalendar title="2025년 3월" weeks={WEEKS} gridGap={19} padX={20} />
        </div>
      </div>
    </AppShell>
  );
}
