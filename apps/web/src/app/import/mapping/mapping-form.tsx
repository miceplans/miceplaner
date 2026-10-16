'use client';

import { useState } from 'react';
import { FLOW_CARD_SHADOW } from '@miceplans/ui';

const A = '/assets/import';

const PROPERTIES = ['행사명', '기간 · 시작', '기간 · 끝', 'Client', 'PM', '상태', '장소'];
const ROWS: { badge?: string; label: string; value: string }[] = [
  { label: '행사명', value: '행사명' },
  { label: '시작일', value: '기간 · 시작' },
  { badge: 'C', label: '종료일', value: '기간 · 끝' },
  { badge: 'D', label: '고객사', value: 'Client' },
  { badge: 'E', label: '담당자', value: 'PM' },
  { badge: 'F', label: '상태', value: '상태' },
  { badge: 'G', label: '장소', value: '장소' },
];

export function MappingForm() {
  const [values, setValues] = useState(ROWS.map((r) => r.value));
  return (
    <div className={`flex w-[760px] shrink-0 flex-col items-start gap-[32px] rounded-lg bg-surface p-[24px] ${FLOW_CARD_SHADOW}`}>
      <p className="m-0 text-lg font-semibold whitespace-nowrap text-fg">2026 청렴 문화의 날</p>
      <div className="flex w-full flex-col items-start gap-[16px]">
        <div className="flex h-[24px] w-full items-start text-xs font-medium whitespace-nowrap text-fg-secondary">
          <div className="flex w-[330px] items-center py-[8px]">Excel 컬럼</div>
          <div className="flex min-w-px flex-1 items-center py-[8px]">시스템 Property</div>
        </div>
        <div className="flex w-full flex-col items-center gap-[24px]">
          <div className="flex w-full flex-col items-start gap-[12px]">
            {ROWS.map((r, i) => (
              <div key={r.label} className="flex w-full items-center">
                <div className="flex w-[330px] items-center gap-[10px] self-stretch">
                  {r.badge ? (
                    <span className="flex size-[22px] items-center justify-center rounded-xs bg-surface-chip text-2xs font-medium text-fg-secondary">{r.badge}</span>
                  ) : null}
                  <span className="text-base whitespace-nowrap text-fg">{r.label}</span>
                </div>
                <label className="relative flex h-[32px] w-[320px] shrink-0 items-center gap-[8px] rounded-sm border border-solid border-border bg-surface px-[10px] text-base text-fg">
                  <select
                    aria-label={`${r.label} 매핑`}
                    value={values[i]}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                    className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                  >
                    {PROPERTIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <span className="whitespace-nowrap">{values[i]}</span>
                  <div className="h-px min-w-px flex-1" />
                  <img alt="" src={`${A}/chevron.svg`} className="size-[14px]" />
                </label>
              </div>
            ))}
          </div>
          <button type="button" className="flex h-[32px] shrink-0 items-center gap-[8px] rounded-sm bg-brand px-[10px] text-base font-medium text-fg-inverse">
            <img alt="" src={`${A}/plus-white.svg`} className="size-[13px]" />
            <span className="whitespace-nowrap">새 Property 만들기</span>
            <span className="h-px w-[6px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
