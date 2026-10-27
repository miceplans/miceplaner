'use client';

import { useContext } from 'react';

import { AssigneeBadge, Checklist, EditableTitle, ItemAccessContext, assignItem, canEditItem, renameItem, type CheckItem } from './event-checklist';
import { matchPart, type PartFilter } from './event-parts';
import { DEFAULT_FILTER, applyFilter, isFilterActive, type ItemFilter } from './event-filter';
import { statusOf } from './event-schedule-list';

/**
 * 할 일 탭. 스케줄을 그룹으로 삼고 그 아래 할 일(스케줄의 children)과
 * 하위 할 일(할 일의 children)을 체크리스트로 관리한다.
 * 스케줄 자체의 추가·삭제는 스케줄 탭에서 한다.
 */
export function EventTasks({
  schedules,
  onChange,
  part = '전체',
  filter = DEFAULT_FILTER,
}: {
  schedules: CheckItem[];
  onChange: (next: (items: CheckItem[]) => CheckItem[]) => void;
  part?: PartFilter;
  filter?: ItemFilter;
}) {
  const { me } = useContext(ItemAccessContext);
  const visible = applyFilter(matchPart(schedules, part), filter, me);

  return (
    <div className="flex w-full flex-col gap-[20px] py-[12px]">
      {visible.map((schedule) => {
        const status = statusOf(schedule);
        return (
          <section key={schedule.id} className="flex flex-col">
            <header className="flex h-[36px] items-center gap-[10px] px-[2px]">
              <img alt="" src={`/assets/event-detail/${status.dot}.svg`} className="size-[7px]" />
              <h3 className="m-0 text-md font-semibold whitespace-nowrap text-fg">
                <EditableTitle readOnly={!canEditItem(schedule, me)} title={schedule.title} onSave={(title) => onChange((list) => renameItem(list, schedule.id, title))} />
              </h3>
              <span className={`text-xs whitespace-nowrap ${status.tone}`}>{status.text}</span>
              {schedule.part && (
                <span className="shrink-0 rounded-md bg-surface-chip px-[6px] py-px text-2xs font-semibold text-fg-secondary">{schedule.part}</span>
              )}
              <span className="min-w-px flex-1" />
              {schedule.date && <span className="whitespace-nowrap text-base text-fg-secondary">{schedule.date}</span>}
              <AssigneeBadge item={schedule} onAssign={(a) => onChange((list) => assignItem(list, schedule.id, a))} />
            </header>
            <div className="ml-[17px]">
              <Checklist
                items={schedule.children ?? []}
                onChange={(fn) => onChange((list) => list.map((s) => (s.id === schedule.id ? { ...s, children: fn(s.children ?? []) } : s)))}
                label="할 일"
              />
            </div>
          </section>
        );
      })}
      {!visible.length && <p className="m-0 px-[2px] py-[8px] text-base text-fg-tertiary">{isFilterActive(filter) ? '조건에 맞는 항목이 없습니다.' : '해당 파트의 스케줄이 없습니다.'}</p>}
    </div>
  );
}
