'use client';

import { useState } from 'react';
import { ViewToggle } from '@miceplans/ui';

const A = '/assets/year-2025';

const OPTIONS = [
  { value: 'gallery', label: '갤러리', icon: `${A}/gallery-icon.svg` },
  { value: 'list', label: '리스트', icon: `${A}/list-icon.svg` },
] as const;

const CARDS = [
  { title: '대한민국 AI 컨퍼런스 2025', meta: '11.27 – 11.28 · 코엑스 Hall C', status: '예정' },
  { title: '서울 국제 관광박람회 2025', meta: '11.15 – 11.17 · 코엑스 Hall A', status: '완료' },
  { title: 'K-물류 박람회 2025', meta: '10.29 – 10.31 · 킨텍스 제2전시장', status: '완료' },
  { title: '국제 반도체 포럼 2025', meta: '11.03 · 그랜드인터컨티넨탈 서울', status: '완료' },
  { title: '핀테크 서밋 2025', meta: '10.16 – 10.17 · 롯데호텔 서울', status: '완료' },
  { title: '글로벌 헬스케어 포럼 2025', meta: '09.25 – 09.26 · 파르나스 컨벤션', status: '완료' },
  { title: '국제 반도체 포럼 2025', meta: '11.03 · 그랜드인터컨티넨탈 서울', status: '완료' },
  { title: '핀테크 서밋 2025', meta: '10.16 – 10.17 · 롯데호텔 서울', status: '완료' },
  { title: '글로벌 헬스케어 포럼 2025', meta: '09.25 – 09.26 · 파르나스 컨벤션', status: '완료' },
];

const TABS = [
  { year: '2023', dark: true },
  { year: '2024', dark: true },
  { year: '2025', active: true },
] as const;

export function YearDetailView() {
  const [view, setView] = useState<'gallery' | 'list'>('gallery');

  return (
    <div className="mx-auto flex w-[1040px] max-w-full flex-col items-start px-[20px] py-[40px] leading-[normal] max-md:py-[24px]">
      <a href="/events-by-year-2" aria-label="연도별 행사로 돌아가기" className="flex items-center">
        <img alt="" src={`${A}/back-icon.svg`} className="size-[16px]" />
      </a>
      <div className="flex w-full flex-col items-start py-[20px]">
        <div className="flex w-full items-center gap-[12px] max-md:flex-wrap">
          <h1 className="m-0 whitespace-nowrap text-3xl font-bold tracking-[-1px] text-fg">2025</h1>
          <div className="h-px min-w-px flex-1" />
          <div className="flex items-center gap-[6px] self-stretch">
            {TABS.map((t) => (
              <span
                key={t.year}
                className={`flex h-[32px] items-center justify-center rounded-md px-[12px] text-base ${
                  'active' in t ? 'bg-info-bg font-semibold text-error-delay' : 'bg-fg-strong font-normal text-fg-disabled'
                }`}
              >
                {t.year}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex w-full items-center gap-[12px] py-[8px] max-md:flex-col max-md:items-start">
        <p className="m-0 whitespace-nowrap text-md text-fg-disabled">행사 12건 · 완료 9건 · 예정 3건</p>
        <div className="h-px min-w-px flex-1" />
        <ViewToggle options={OPTIONS} value={view} onChange={setView} />
      </div>
      <div className={`grid w-full gap-[20px] py-[32px] ${view === 'gallery' ? 'grid-cols-3 max-md:grid-cols-1' : 'grid-cols-1'}`}>
        {CARDS.map((c, i) => (
          <div key={i} className={`flex min-w-px items-start gap-[10px] ${view === 'gallery' ? 'flex-col' : 'rounded-xl border border-border p-[12px]'}`}>
            <div className={`relative shrink-0 overflow-clip rounded-xl bg-expired ${view === 'gallery' ? 'h-[190px] w-full' : 'h-[72px] w-[110px]'}`}>
              <span
                className={`absolute left-[10px] top-[10px] flex h-[24px] items-center justify-center rounded-md bg-fg-inverse/95 px-[8px] text-xs font-semibold ${
                  c.status === '예정' ? 'text-error-delay' : 'text-fg-disabled'
                }`}
              >
                {c.status}
              </span>
            </div>
            <div className="flex flex-col items-start gap-[4px] whitespace-nowrap">
              <p className="m-0 text-lg font-semibold text-fg">{c.title}</p>
              <p className="m-0 text-base text-fg-disabled">{c.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
