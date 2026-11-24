'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StatusPill, ViewToggle } from '@miceplans/ui';
import { useEventsList } from '../../lib/api/generated/endpoints';
import type { EventListItemDto } from '@miceplans/contracts';

const A = '/assets/events-by-year';

const OPTIONS = [
  { value: 'folder', label: '폴더 뷰', icon: `${A}/gallery-icon.svg` },
  { value: 'list', label: '리스트', icon: `${A}/list-icon.svg` },
] as const;

type YearGroup = { year: number; count: number; events: EventListItemDto[] };

/** 행사 목록을 연도 내림차순으로 묶는다. */
function groupByYear(events: EventListItemDto[]): YearGroup[] {
  const byYear = new Map<number, EventListItemDto[]>();
  for (const e of events) {
    const year = Number(e.startDate.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    byYear.set(year, [...(byYear.get(year) ?? []), e]);
  }
  return [...byYear.entries()]
    .map(([year, list]) => ({ year, count: list.length, events: list.sort((a, b) => b.startDate.localeCompare(a.startDate)) }))
    .sort((a, b) => b.year - a.year);
}

const fmtDate = (d: string) => d.split('-').join('. ');

export function EventsByYearView() {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<'folder' | 'list'>('list');
  const events = useEventsList();
  const groups = groupByYear(events.data ?? []);
  const selectedYear = Number(params.get('year'));
  const selected = Number.isInteger(selectedYear) ? groups.find((g) => g.year === selectedYear) : undefined;

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
        {selected ? (
          <div className="flex w-full flex-col items-start py-[16px]">
            <button
              type="button"
              onClick={() => router.push('/events-by-year')}
              className="mb-[12px] flex h-[28px] items-center gap-[4px] rounded-md px-[6px] text-base text-fg-secondary hover:bg-surface-chip"
            >
              <img alt="" src={`${A}/chevron.svg`} className="size-[16px] rotate-180" />
              전체 연도
            </button>
            <h2 className="m-0 mb-[12px] w-full text-xl font-semibold text-fg">{selected.year}년 행사 {selected.count}건</h2>
            {selected.events.map((e) => (
              <a
                key={e.id}
                href={`/events/detail?id=${e.id}`}
                className="flex w-full shrink-0 items-center gap-[16px] border-b border-solid border-border py-[14px] no-underline hover:bg-surface-sunken"
              >
                <span className="min-w-0 flex-1 truncate text-base font-semibold text-fg">{e.name}</span>
                <span className="whitespace-nowrap text-base text-fg-secondary">
                  {e.startDate === e.endDate ? fmtDate(e.startDate) : `${fmtDate(e.startDate)} – ${fmtDate(e.endDate)}`}
                </span>
                {e.clientName ? <span className="whitespace-nowrap text-base text-fg-secondary">{e.clientName}</span> : null}
                <StatusPill status={e.status} />
                <img alt="" src={`${A}/chevron.svg`} className="size-[20px] shrink-0" />
              </a>
            ))}
            {!selected.events.length && <p className="m-0 py-[12px] text-base text-fg-tertiary">이 연도에 등록된 행사가 없습니다.</p>}
          </div>
        ) : (
        <div className={view === 'folder' ? 'flex w-full flex-col items-start py-[32px]' : 'grid w-full grid-cols-2 gap-[12px] py-[32px] max-md:grid-cols-1'}>
          {groups.map((g) => (
            <a
              key={g.year}
              href={`/events-by-year?year=${g.year}`}
              className={`flex w-full shrink-0 items-center gap-[16px] border-solid border-border no-underline ${view === 'folder' ? 'h-[104px] border-b py-[20px]' : 'h-auto flex-wrap content-start rounded-xl border bg-surface-sunken p-[16px]'}`}
            >
              <div className={`flex shrink-0 flex-col items-start gap-[5px] whitespace-nowrap ${view === 'folder' ? 'h-full w-[70px] justify-center' : 'h-auto min-w-0 flex-1'}`}>
                <span className={`text-2xl font-bold tracking-[-0.5px] ${g.year === new Date().getFullYear() ? 'text-brand' : 'text-fg'}`}>{g.year}</span>
                <span className="text-base text-fg-disabled">행사 {g.count}건</span>
              </div>
              <div className={`flex gap-[8px] ${view === 'folder' ? 'h-full items-center' : 'order-last w-full min-w-0'}`}>
                {g.events.slice(0, 3).map((e) => (
                  <div key={e.id} style={{ backgroundColor: e.color ?? undefined }} className={`h-[64px] rounded-md ${view === 'folder' ? 'w-[96px] shrink-0' : 'min-w-0 flex-1'}`} />
                ))}
                {[...Array(Math.max(0, 3 - g.events.length))].map((_, n) => (
                  <div key={`empty-${n}`} className={`h-[64px] rounded-md bg-expired ${view === 'folder' ? 'w-[96px] shrink-0' : 'min-w-0 flex-1'}`} />
                ))}
              </div>
              {view === 'folder' ? <div className="h-px min-w-px flex-1" /> : null}
              {g.year === new Date().getFullYear() ? (
                <span className="flex h-[24px] items-center justify-center whitespace-nowrap rounded-md bg-brand-tint px-[8px] text-xs font-semibold text-error-delay">올해</span>
              ) : null}
              <img alt="" src={`${A}/chevron.svg`} className="size-[20px] shrink-0" />
            </a>
          ))}
          {!groups.length && <p className="m-0 py-[32px] text-base text-fg-tertiary">등록된 행사가 없습니다.</p>}
        </div>
        )}
      </div>
    </div>
  );
}
