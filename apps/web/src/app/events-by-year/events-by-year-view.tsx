'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ViewToggle } from '@miceplans/ui';

const A = '/assets/events-by-year';

const YEARS: { year: number; count: number; current?: boolean }[] = [];

const OPTIONS = [
  { value: 'folder', label: '폴더 뷰', icon: `${A}/gallery-icon.svg` },
  { value: 'list', label: '리스트', icon: `${A}/list-icon.svg` },
] as const;

export function EventsByYearView() {
  const router = useRouter();
  const [view, setView] = useState<'folder' | 'list'>('folder');

  return (
    <div className="flex w-full flex-col items-center leading-[normal]">
      <div className="flex w-[720px] max-w-full shrink-0 flex-col items-start gap-[64px] px-[20px] py-[60px] max-md:gap-[32px] max-md:py-[32px]">
        <div className="flex w-full items-start justify-between gap-[12px] max-md:flex-col">
          <h1 className="m-0 whitespace-nowrap text-3xl font-bold tracking-[-1px] text-fg">연도별 행사</h1>
          <ViewToggle options={OPTIONS} value={view} onChange={(v) => {
              setView(v);
              if (v === 'folder') router.push('/events-by-year-2');
            }}
          />
        </div>
        <div className={view === 'folder' ? 'flex w-full flex-col items-start py-[32px]' : 'grid w-full grid-cols-2 gap-[12px] py-[32px] max-md:grid-cols-1'}>
          {YEARS.map((y) => (
            <a
              key={y.year}
              className={`flex w-full shrink-0 items-center gap-[16px] border-solid border-border ${view === 'folder' ? 'h-[104px] border-b py-[20px]' : 'h-auto flex-wrap content-start rounded-xl border bg-surface-sunken p-[16px]'}`}
            >
              <div className={`flex shrink-0 flex-col items-start gap-[5px] whitespace-nowrap ${view === 'folder' ? 'h-full w-[70px] justify-center' : 'h-auto min-w-0 flex-1'}`}>
                <span className={`text-2xl font-bold tracking-[-0.5px] ${y.current ? 'text-brand' : 'text-fg'}`}>{y.year}</span>
                <span className="text-base text-fg-disabled">행사 {y.count}건</span>
              </div>
              <div className={`flex gap-[8px] ${view === 'folder' ? 'h-full items-center' : 'order-last w-full min-w-0'}`}>
                {[0, 1, 2].map((n) => (
                  <div key={n} className={`h-[64px] rounded-md bg-expired ${view === 'folder' ? 'w-[96px] shrink-0' : 'min-w-0 flex-1'}`} />
                ))}
              </div>
              {view === 'folder' ? <div className="h-px min-w-px flex-1" /> : null}
              {y.current ? (
                <span className="flex h-[24px] items-center justify-center whitespace-nowrap rounded-md bg-brand-tint px-[8px] text-xs font-semibold text-error-delay">올해</span>
              ) : null}
              <img alt="" src={`${A}/chevron.svg`} className="size-[20px] shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
