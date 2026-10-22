'use client';

import { useMemo, useState } from 'react';
import { FlowTopbar, PageFrame } from '@miceplans/ui';
import { PARTNER_FIELDS, PARTNER_FIELD_BADGE, PARTNERS, type PartnerField } from '../../data/partners';

type Filter = '전체' | PartnerField;

export function PartnersView() {
  const [filter, setFilter] = useState<Filter>('전체');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return PARTNERS.filter((p) => (filter === '전체' ? true : p.field === filter)).filter((p) =>
      q ? [p.name, p.manager].some((v) => v.toLowerCase().includes(q)) : true,
    );
  }, [filter, q]);

  return (
    <PageFrame topbar={<FlowTopbar title="외부 협력사" />}>
      <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] px-[24px] py-[20px]">
        <div className="flex w-full items-center gap-[12px]">
          <div className="flex items-center gap-[6px]" role="tablist" aria-label="분야별 필터">
            {(['전체', ...PARTNER_FIELDS] as Filter[]).map((f) => {
              const on = filter === f;
              const count = f === '전체' ? PARTNERS.length : PARTNERS.filter((p) => p.field === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(f)}
                  className={`flex h-[30px] items-center gap-[6px] rounded-sm px-[11px] ${
                    on ? 'bg-brand text-fg-inverse' : 'bg-surface-chip text-fg-secondary hover:text-fg'
                  }`}
                >
                  <span className="whitespace-nowrap text-xs font-medium">{f}</span>
                  <span className={`whitespace-nowrap text-2xs ${on ? 'text-fg-inverse' : 'text-fg-tertiary'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="h-px min-w-px flex-1" />
          <label className="flex h-[30px] w-[220px] items-center gap-[8px] rounded-sm bg-surface-chip px-[10px]">
            <svg viewBox="0 0 16 16" fill="none" className="size-[13px] shrink-0" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" className="text-fg-tertiary" strokeWidth="1.5" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" className="text-fg-tertiary" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-tertiary"
            />
          </label>
        </div>
        <div className="flex w-full items-center justify-between">
          <span className="whitespace-nowrap text-xs text-fg-tertiary">
            협력사 <span className="font-semibold text-fg">{rows.length}</span>개
            {q || filter !== '전체' ? ` (전체 ${PARTNERS.length}개)` : ''}
          </span>
        </div>
        <div className="flex w-full flex-col items-start rounded-lg border border-solid border-border">
          <div className="flex h-[36px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface-sunken px-[16px] text-2xs font-semibold tracking-[0.4px] text-fg-tertiary">
            <span className="w-[180px] shrink-0">업체</span>
            <span className="w-[90px] shrink-0">분야</span>
            <span className="w-[110px] shrink-0">담당자</span>
            <span className="w-[140px] shrink-0">연락처</span>
            <span className="w-[260px] shrink-0">주요 거래 행사</span>
            <span className="min-w-0 flex-1">메모</span>
          </div>
          {rows.map((p, i) => (
            <div
              key={p.id}
              className={`flex w-full shrink-0 items-center gap-[12px] px-[16px] py-[10px] ${i < rows.length - 1 ? 'border-b border-solid border-border' : ''}`}
            >
              <div className="flex w-[180px] shrink-0 flex-col items-start gap-[2px]">
                <span className="whitespace-nowrap text-sm font-semibold text-fg">{p.name}</span>
                <span className="whitespace-nowrap text-2xs text-fg-tertiary">{p.email}</span>
              </div>
              <div className="w-[90px] shrink-0">
                <span className={`flex h-[22px] w-fit items-center justify-center whitespace-nowrap rounded-sm px-[8px] text-2xs font-bold ${PARTNER_FIELD_BADGE}`}>
                  {p.field}
                </span>
              </div>
              <div className="flex w-[110px] shrink-0 flex-col items-start gap-[2px]">
                <span className="whitespace-nowrap text-xs font-medium text-fg-secondary">{p.manager}</span>
              </div>
              <span className="w-[140px] shrink-0 whitespace-nowrap text-xs text-fg-secondary">{p.phone}</span>
              <span className="w-[260px] shrink-0 whitespace-nowrap text-xs text-fg-secondary">{p.events}</span>
              <span className="min-w-0 flex-1 truncate text-2xs text-fg-tertiary">{p.memo}</span>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="flex w-full items-center justify-center px-[16px] py-[28px]">
              <span className="text-xs text-fg-tertiary">조건에 맞는 협력사가 없습니다.</span>
            </div>
          ) : null}
        </div>
      </div>
    </PageFrame>
  );
}
