'use client';

import { useMemo, useState } from 'react';
import { BOARD_COLUMNS, buildBoardItems, groupBoardItems, type BoardColumnKey } from './task-board';
import type { CheckItem } from './event-checklist-model';
import type { RequestRow } from './event-products-model';

const A = '/assets/event-detail';
const CARD = 'rounded-xl bg-surface shadow-card';
/** 열마다 보여 줄 카드 수. 나머지는 '+ N개 더'로 표시한다. */
const VISIBLE = 2;

const STYLE: Record<BoardColumnKey, { dot: string; badge: string; moreTone: string }> = {
  진행: { dot: 'bg-brand-blue', badge: 'bg-info-bg text-info', moreTone: 'text-error-delay' },
  '검토 대기': { dot: 'bg-brand-pink', badge: 'bg-error-bg text-error', moreTone: 'text-error-delay' },
  완료: { dot: 'bg-success-solid', badge: 'bg-success-bg text-success-deep', moreTone: 'text-success-deep' },
  보류: { dot: 'bg-fg-tertiary', badge: 'bg-surface-chip text-fg-secondary', moreTone: 'text-fg-secondary' },
};

/** 행사의 Task를 상태별 열로 보여 준다. API에 없는 목업 행사(e1~e5)는 표시하지 않는다. */
export function TaskBoard({ schedules = [], products = [] }: { eventId?: string; schedules?: CheckItem[]; products?: RequestRow[] }) {
  const [expanded, setExpanded] = useState<Partial<Record<BoardColumnKey, boolean>>>({});
  // 스케줄 트리가 서버 할 일을 담고 있으므로 서버 목록을 따로 합치지 않는다.
  const groups = useMemo(() => groupBoardItems(buildBoardItems([], schedules, products)), [schedules, products]);

  return (
    <div className="grid grid-cols-4 gap-[24px] px-[5px] max-lg:grid-cols-2 max-sm:grid-cols-1">
      {BOARD_COLUMNS.map((col) => {
        const tasks = groups[col];
        const s = STYLE[col];
        const shown = expanded[col] ? tasks : tasks.slice(0, VISIBLE);
        const hidden = tasks.length - shown.length;
        return (
          <section key={col} className={`flex flex-col gap-[8px] p-[14px] ${CARD}`}>
            <div className="mb-[2px] flex items-center gap-[7px]">
              <span className={`size-[8px] rounded-full ${s.dot}`} />
              <h3 className="m-0 text-base font-semibold text-fg">{col}</h3>
              <span className="flex-1" />
              <span className={`flex h-[18px] min-w-[26px] items-center justify-center rounded-full px-[6px] text-2xs font-semibold ${s.badge}`}>{tasks.length}</span>
            </div>
            {tasks.length === 0 && <p className="m-0 px-[2px] py-[6px] text-[11px] text-fg-muted">항목 없음</p>}
            {shown.map((t) => {
              const done = t.column === '완료';
              return (
                <div key={t.id} className="flex flex-col gap-[7px] rounded-xl bg-surface-muted px-[11px] py-[10px]">
                  <div className="flex items-center gap-[8px]">
                    {done ? (
                      <span className="flex size-[17px] shrink-0 items-center justify-center rounded-md bg-success-solid">
                        <img alt="" src={`${A}/check.svg`} className="size-[10px]" />
                      </span>
                    ) : (
                      <span className="size-[17px] shrink-0 rounded-md border-[1.5px] border-solid border-border-strong" />
                    )}
                    <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${done ? 'text-fg-secondary' : 'text-fg'}`} title={t.title}>
                      {t.title}
                    </span>
                  </div>
                  <p className="m-0 flex items-center gap-[5px] text-[10.5px] text-fg-muted">
                    <span className="size-[3px] rounded-full bg-fg-muted" />
                    {t.source === '제작물' ? `제작물 · ${t.meta}` : t.meta}
                  </p>
                </div>
              );
            })}
            {(hidden > 0 || expanded[col]) && tasks.length > VISIBLE && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [col]: !e[col] }))}
                className={`m-0 cursor-pointer self-start border-0 bg-transparent p-[2px] text-[11px] font-semibold ${s.moreTone}`}
              >
                {expanded[col] ? '접기' : `+ ${hidden}개 더`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
