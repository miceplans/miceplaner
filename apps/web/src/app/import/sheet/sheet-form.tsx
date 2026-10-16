'use client';

import { useState } from 'react';
import { FLOW_CARD_SHADOW } from '@miceplans/ui';

const A = '/assets/import';

const SHEETS = [
  { name: '전체 행사', meta: '1,248행 · 8개 열' },
  { name: '예산', meta: '312행 · 6개 열' },
  { name: '업체 리스트', meta: '87행 · 4개 열' },
];
const ROWS = ['1행', '2행', '3행'];

export function SheetForm() {
  const [sheet, setSheet] = useState(0);
  const [useHeader, setUseHeader] = useState(true);
  const [row, setRow] = useState('1행');
  return (
    <div className={`flex h-[398px] w-full flex-col items-start gap-[20px] rounded-lg bg-surface p-[24px] ${FLOW_CARD_SHADOW}`}>
      <div className="flex h-[68px] w-full shrink-0 items-center gap-[12px] rounded-md bg-surface-subtle p-[14px]">
        <img alt="" src={`${A}/excel.png`} className="h-[26.648px] w-[25.899px] shrink-0 object-cover" />
        <div className="flex flex-col items-start gap-[2px] whitespace-nowrap">
          <p className="m-0 text-md font-semibold text-fg">2025_행사리스트.xlsx</p>
          <p className="m-0 text-xs text-fg-secondary">2.4 MB · 시트 3개 · 수정됨 2025.03.04</p>
        </div>
      </div>
      <div className="flex w-full flex-col items-start gap-[12px]">
        <p className="m-0 text-base font-semibold whitespace-nowrap text-fg">시트 선택</p>
        <div role="radiogroup" aria-label="시트 선택" className="flex w-full flex-col items-start gap-[4px]">
          {SHEETS.map((s, i) => {
            const on = i === sheet;
            return (
              <button
                key={s.name}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSheet(i)}
                className={`flex h-[52px] w-full items-center gap-[12px] rounded-md px-[14px] py-[8px] text-left ${on ? 'bg-brand-tint' : 'bg-surface-subtle'}`}
              >
                {on ? (
                  <img alt="" src={`${A}/radio.svg`} className="size-[18px] shrink-0" />
                ) : (
                  <span className="size-[18px] shrink-0 rounded-md border border-solid border-border-placeholder bg-surface" />
                )}
                <span className="flex flex-col items-start gap-px whitespace-nowrap">
                  <span className="text-md font-medium text-fg">{s.name}</span>
                  <span className="text-xs text-fg-secondary">{s.meta}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex w-full items-center gap-[12px] py-[4px]">
        <div className="flex flex-col items-start gap-[2px] whitespace-nowrap">
          <p className="m-0 text-base font-semibold text-fg">헤더 행</p>
          <p className="m-0 text-xs text-fg-secondary">열 이름이 담긴 행을 헤더로 사용합니다</p>
        </div>
        <div className="h-px min-w-px flex-1" />
        <button type="button" role="switch" aria-checked={useHeader} aria-label="헤더 행 사용" onClick={() => setUseHeader((v) => !v)} className="flex h-[20px] w-[34px] shrink-0">
          {useHeader ? (
            <img alt="" src={`${A}/toggle-switch.svg`} className="h-[20px] w-[34px]" />
          ) : (
            <span className="relative block h-[20px] w-[34px] rounded-lg bg-border-placeholder">
              <span className="absolute top-[2px] left-[2px] size-[16px] rounded-full bg-surface" />
            </span>
          )}
        </button>
        <label className="relative flex h-[32px] shrink-0 items-center gap-[8px] rounded-sm border border-solid border-border bg-surface px-[10px] text-sm text-fg">
          <select
            value={row}
            disabled={!useHeader}
            onChange={(e) => setRow(e.target.value)}
            className="absolute inset-0 cursor-pointer appearance-none opacity-0 disabled:cursor-default"
          >
            {ROWS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <span className={useHeader ? '' : 'text-fg-tertiary'}>{row}</span>
          <img alt="" src={`${A}/chevron.svg`} className="size-[14px]" />
        </label>
      </div>
    </div>
  );
}
