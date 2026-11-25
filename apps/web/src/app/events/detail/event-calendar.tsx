'use client';

import { useMemo, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { Dialog, Input, SegmentControl, Select, SidePeekPanel } from '@miceplans/ui';
import { createPersistedStore, usePersisted } from '@miceplans/ui/persisted-store';
import type { CheckItem } from './event-checklist-model';
import { useScheduleNoteStore } from '../../schedule-calendar/schedule-note-store';

const A = '/assets/event-detail';

const CAL_VIEWS = [
  { value: 'Day', label: 'Day' },
  { value: 'Week', label: 'Week' },
  { value: 'Month', label: 'Month' },
] as const;

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
// 실제 이번 주 월요일을 기준으로 삼는다. 고정 날짜를 쓰면 '오늘' 표시와 주 이동이 실제 날짜와 어긋난다.
const BASE_MONDAY = (() => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return t;
})();
const TODAY_INDEX = (new Date().getDay() + 6) % 7; // 월=0 … 일=6
const dateOf = (abs: number) => new Date(BASE_MONDAY.getFullYear(), BASE_MONDAY.getMonth(), BASE_MONDAY.getDate() + abs);
// dateOf의 역함수. 서머타임으로 하루가 23·25시간이 되어도 반올림으로 정확한 일수를 얻는다.
const absOf = (d: Date) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - BASE_MONDAY.getTime()) / 86_400_000);
const weekStartOf = (abs: number) => abs - (((abs % 7) + 7) % 7);
const KO_DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
const HOUR_H = 48;
const SNAP = 0.5; // 30분 단위
const DAY_START = 9;
const DAY_SPAN = HOURS.length - 1; // 9시 ~ 20시 중 표시 구간(시간)
const DRAG_THRESHOLD = 4;

export type CalEvent = { id: string; eventId: string; day: number; title: string; start: number; end: number; source?: 'calendar' | 'schedule' };

// 캘린더에는 여러 행사의 일정이 함께 보이며, 블록 색은 소속 행사의 대표색이다.
// 현재 보고 있는 행사가 아닌 블록은 흐리게 처리한다.
const OTHER_EVENT_OPACITY = 0.3;

// day: BASE_MONDAY 기준 일수, start/end: 9시 기준 시간(h)
// 블록은 서버 일정이 아니라 화면 상태로 두고, 표와 같이 브라우저 저장소에 기억한다.

function formatClock(h: number) {
  const total = DAY_START + h;
  const hour = Math.floor(total);
  const min = total % 1 ? '30' : '00';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { text: `${h12}:${min}`, ampm: hour >= 12 ? 'PM' : 'AM' };
}

function formatRange(start: number, end: number) {
  const s = formatClock(start);
  const e = formatClock(end);
  return s.ampm === e.ampm ? `${s.text} – ${e.text} ${e.ampm}` : `${s.text} ${s.ampm} – ${e.text} ${e.ampm}`;
}

const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 보기와 기준 날짜를 저장해 새로고침 후에도 유지한다. 기준 날짜는 YYYY-MM-DD 절대 날짜로 저장해 주가 바뀌어도 어긋나지 않게 한다. */
const CAL_PREFS_KEY = 'miceplans.event-detail.calendar';

type CalView = 'Day' | 'Week' | 'Month';
/** anchorDate가 null이면 오늘을 기준으로 한다. */
type CalPrefs = { view: CalView; anchorDate: string | null };

const DEFAULT_CAL_PREFS: CalPrefs = { view: 'Week', anchorDate: null };

function decodeCalPrefs(raw: unknown): CalPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_CAL_PREFS;
  const { view, anchorDate } = raw as { view?: unknown; anchorDate?: unknown };
  return {
    view: view === 'Day' || view === 'Week' || view === 'Month' ? view : DEFAULT_CAL_PREFS.view,
    anchorDate: typeof anchorDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(anchorDate) ? anchorDate : null,
  };
}

const calPrefsStore = createPersistedStore<CalPrefs>({ key: CAL_PREFS_KEY, fallback: DEFAULT_CAL_PREFS, decode: decodeCalPrefs });

function anchorOf(anchorDate: string | null): number {
  if (!anchorDate) return TODAY_INDEX;
  const [y, m, d] = anchorDate.split('-').map(Number);
  return absOf(new Date(y!, m! - 1, d!));
}

/** 행사 상세의 주간·월간 캘린더. 블록 드래그 이동, 일정 추가, 더블클릭 상세 패널을 담당한다. */
export function EventCalendar({
  eventId,
  color,
  place,
  schedule,
  members,
  calEvents,
  onCalEventsChange,
}: {
  eventId: string;
  /** 행사 대표색. 이 행사의 일정 블록 색으로 쓴다. */
  color: string;
  place: string;
  /** 스케줄 탭의 항목. 날짜가 있는 항목을 캘린더 블록으로 함께 보여 준다. */
  schedule: CheckItem[];
  /** 상세 패널에서 담당자로 지정할 수 있는 인력 이름. */
  members: string[];
  calEvents: CalEvent[];
  onCalEventsChange: Dispatch<SetStateAction<CalEvent[]>>;
}) {
  const [{ view: calView, anchorDate: savedAnchor }, setCalPrefs] = usePersisted(calPrefsStore);
  const setCalView = (view: CalView) => setCalPrefs((prev) => ({ ...prev, view }));
  const [calDialog, setCalDialog] = useState(false);
  // 캘린더가 가리키는 날(BASE_MONDAY 기준 일수). Day/Week/Month 모두 이 날을 기준으로 표시 구간을 정한다.
  const anchor = anchorOf(savedAnchor);
  const setAnchor = (abs: number) => setCalPrefs((prev) => ({ ...prev, anchorDate: toYMD(dateOf(abs)) }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const peekStore = useScheduleNoteStore(eventId || null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; x: number; y: number; origin: CalEvent; moved: boolean } | null>(null);

  const onEventPointerDown = (e: ReactPointerEvent<HTMLDivElement>, ev: CalEvent) => {
    if (ev.source === 'schedule') {
      setSelectedId(ev.id);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: ev.id, x: e.clientX, y: e.clientY, origin: ev, moved: false };
    setSelectedId(ev.id);
  };

  const onEventPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const grid = gridRef.current;
    if (!drag || !grid) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setDraggingId(drag.id);
    }
    const colW = grid.getBoundingClientRect().width / visibleDays.length;
    const dayDelta = Math.round(dx / colW);
    const timeDelta = Math.round(dy / HOUR_H / SNAP) * SNAP;
    const { origin } = drag;
    const length = origin.end - origin.start;
    const start = Math.min(Math.max(origin.start + timeDelta, 0), DAY_SPAN - length);
    const dayIndex = Math.min(Math.max(origin.day + dayDelta, rangeStart), rangeEnd);
    onCalEventsChange((list) => list.map((x) => (x.id === drag.id ? { ...x, day: dayIndex, start, end: start + length } : x)));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDraggingId(null);
  };

  const scheduleCalEvents = useMemo<CalEvent[]>(
    () => schedule.flatMap((item) => {
      if (!item.date) return [];
      const [year, month, day] = item.date.split('-').map(Number);
      if (!year || !month || !day) return [];
      return [{
        id: `schedule:${item.id}`,
        eventId,
        day: absOf(new Date(year, month - 1, day)),
        title: item.title,
        start: item.start ?? 0,
        end: item.end ?? 1,
        source: 'schedule' as const,
      }];
    }),
    [schedule, eventId],
  );
  const calendarEvents = useMemo(() => [...calEvents, ...scheduleCalEvents], [calEvents, scheduleCalEvents]);
  const peekEvent = calendarEvents.find((x) => x.id === peekId) ?? null;
  const weekStartAbs = weekStartOf(anchor);
  const visibleDays = calView === 'Day' ? [anchor] : Array.from({ length: 7 }, (_, i) => weekStartAbs + i);
  const rangeStart = visibleDays[0]!;
  const rangeEnd = visibleDays[visibleDays.length - 1]!;
  const anchorDate = dateOf(anchor);
  // 월 보기: 해당 월 1일이 속한 주의 월요일부터 말일이 속한 주의 일요일까지 표시한다.
  const monthFirstAbs = absOf(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1));
  const monthLastAbs = absOf(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0));
  const monthGridStart = weekStartOf(monthFirstAbs);
  const monthGridDays = Array.from({ length: weekStartOf(monthLastAbs) + 7 - monthGridStart }, (_, i) => monthGridStart + i);

  const weekStart = dateOf(rangeStart);
  const weekEnd = dateOf(rangeEnd);
  const calLabel =
    calView === 'Day'
      ? `${anchorDate.getMonth() + 1}월 ${anchorDate.getDate()}일 (${KO_DAY_NAMES[((anchor % 7) + 7) % 7]})`
      : calView === 'Month'
        ? `${anchorDate.getFullYear()}년 ${anchorDate.getMonth() + 1}월`
        : weekStart.getMonth() === weekEnd.getMonth()
          ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}~${weekEnd.getDate()}`
          : `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일~${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;
  const unitLabel = calView === 'Day' ? '날' : calView === 'Month' ? '달' : '주';
  const moveCalendar = (dir: -1 | 1) => {
    if (calView === 'Day') setAnchor(anchor + dir);
    else if (calView === 'Week') setAnchor(anchor + dir * 7);
    else setAnchor(absOf(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1)));
  };
  // 다른 행사 블록의 색은 알 수 없으니 회색으로 두고, 지금 행사만 대표색을 쓴다.
  const calColorOf = (e: CalEvent) => (e.eventId === eventId ? color : '#9aa0a6');
  const addCalEvent = (title: string, date: string, start: number, end: number) => {
    const day = absOf(new Date(`${date}T00:00:00`));
    onCalEventsChange((list) => [...list, { id: crypto.randomUUID(), eventId, day, title, start, end }]);
    setAnchor(day);
    setCalDialog(false);
  };

  return (
    <>
      <section className="mt-[16px] flex w-full flex-col gap-[12px] rounded-xl bg-surface p-[16px] shadow-card">
        <div className="flex items-center gap-[12px] px-[8px] pt-[8px]">
          <button type="button" aria-label={`이전 ${unitLabel}`} onClick={() => moveCalendar(-1)} className="flex size-[24px] items-center justify-center rounded-md hover:bg-surface-chip"><img alt="" src={`${A}/cal-prev.svg`} className="size-[14px]" /></button>
          <h3 className="m-0 text-lg font-semibold text-fg">{calLabel}</h3>
          <button type="button" aria-label={`다음 ${unitLabel}`} onClick={() => moveCalendar(1)} className="flex size-[24px] items-center justify-center rounded-md hover:bg-surface-chip"><img alt="" src={`${A}/cal-next.svg`} className="size-[14px]" /></button>
          <button type="button" onClick={() => setAnchor(TODAY_INDEX)} className="h-[24px] rounded-md border border-solid border-border px-[8px] text-xs text-fg-secondary hover:bg-surface-sunken">오늘</button>
          <button type="button" onClick={() => setCalDialog(true)} className="flex h-[24px] items-center gap-[4px] rounded-md bg-brand px-[8px] text-xs font-semibold text-fg-inverse hover:opacity-90">
            <img alt="" src={`${A}/add.svg`} className="size-[12px]" />
            일정 추가
          </button>
          <span className="flex-1" />
          <SegmentControl options={CAL_VIEWS} value={calView} onChange={setCalView} size="sm" />
        </div>

        {calView === 'Month' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7">
                {DAY_NAMES.map((name) => (
                  <span key={name} className="pb-[8px] text-center text-[9px] font-semibold text-fg-tertiary">{name}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 border-0 border-l border-t border-solid border-border-soft">
                {monthGridDays.map((abs, i) => {
                  const inMonth = abs >= monthFirstAbs && abs <= monthLastAbs;
                  const dayEvents = calendarEvents.filter((e) => e.day === abs).sort((a, b) => a.start - b.start);
                  return (
                    <button
                      key={abs}
                      type="button"
                      aria-label={`${dateOf(abs).getMonth() + 1}월 ${dateOf(abs).getDate()}일 일정 보기`}
                      onClick={() => { setAnchor(abs); setCalView('Day'); }}
                      className={`flex h-[96px] min-w-0 flex-col items-stretch gap-[2px] overflow-hidden border-0 border-b border-r border-solid border-border-soft p-[4px] text-left ${
                        abs === TODAY_INDEX ? 'bg-error-bg/60' : i % 7 >= 5 ? 'bg-surface-sunken' : 'bg-transparent'
                      } hover:bg-surface-chip`}
                    >
                      <span
                        className={`self-start rounded-md px-[4px] text-xs font-semibold ${
                          abs === TODAY_INDEX ? 'bg-error-brand text-fg-inverse' : inMonth ? 'text-fg-secondary' : 'text-fg-tertiary/60'
                        }`}
                      >
                        {dateOf(abs).getDate()}
                      </span>
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          style={{ backgroundColor: calColorOf(e), opacity: e.eventId === eventId ? 1 : OTHER_EVENT_OPACITY }}
                          className="truncate rounded-sm px-[4px] text-[10px] font-semibold leading-[16px] text-fg-inverse"
                        >
                          {e.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && <span className="px-[4px] text-[10px] text-fg-tertiary">+{dayEvents.length - 3}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid" style={{ gridTemplateColumns: `48px repeat(${visibleDays.length}, minmax(0, 1fr))` }}>
              <div />
              {visibleDays.map((abs) => {
                const name = DAY_NAMES[((abs % 7) + 7) % 7]!;
                const isToday = abs === TODAY_INDEX;
                return (
                  <div key={abs} className="flex flex-col items-center gap-[2px] pb-[8px] text-center">
                    {isToday ? (
                      <span className="flex flex-col items-center rounded-md bg-error-brand px-[8px] py-[2px] text-fg-inverse">
                        <span className="text-[9px] font-semibold">{name.slice(0, 3)}</span>
                        <span className="text-base font-bold">{dateOf(abs).getDate()}</span>
                      </span>
                    ) : (
                      <>
                        <span className="text-[9px] font-semibold text-fg-tertiary">{name}</span>
                        <span className="text-base font-semibold text-fg-secondary">{dateOf(abs).getDate()}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-[48px_minmax(0,1fr)]" style={{ height: HOURS.length * HOUR_H }}>
              <div className="relative">
                {HOURS.map((h, i) => (
                  <span key={h} style={{ top: i * HOUR_H - 6 }} className="absolute right-[10px] text-[9px] text-fg-tertiary">{h}</span>
                ))}
              </div>
              <div ref={gridRef} className="relative grid" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }} onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
                {visibleDays.map((abs) => {
                  const weekend = ((abs % 7) + 7) % 7 >= 5;
                  return (
                    <div
                      key={abs}
                      onPointerDown={() => setSelectedId(null)}
                      className={`relative border-0 border-l border-solid border-border-soft ${abs === TODAY_INDEX ? 'bg-error-bg/60' : weekend ? 'bg-surface-sunken' : ''}`}
                    >
                      {HOURS.map((h, i) => (
                        <div key={h} style={{ top: i * HOUR_H }} className="pointer-events-none absolute inset-x-0 border-0 border-t border-solid border-border-soft" />
                      ))}
                      {abs === TODAY_INDEX && <div style={{ top: 6.5 * HOUR_H }} className="pointer-events-none absolute inset-x-0 z-[2] h-px bg-error-brand" />}
                    </div>
                  );
                })}

                {calendarEvents
                  .filter((e) => e.day >= rangeStart && e.day <= rangeEnd)
                  .map((e) => {
                    const di = e.day - rangeStart;
                    const cols = visibleDays.length;
                    const dragging = draggingId === e.id;
                    const selected = selectedId === e.id;
                    return (
                      <div
                        key={e.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${e.title} ${formatRange(e.start, e.end)}`}
                        aria-pressed={selected}
                        onPointerDown={(ev) => { ev.stopPropagation(); onEventPointerDown(ev, e); }}
                        onPointerMove={e.source === 'schedule' ? undefined : onEventPointerMove}
                        onPointerUp={e.source === 'schedule' ? undefined : endDrag}
                        onPointerCancel={e.source === 'schedule' ? undefined : endDrag}
                        onDoubleClick={() => { endDrag(); setSelectedId(e.id); setPeekId(e.id); }}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelectedId(e.id); setPeekId(e.id); }
                          if (e.source === 'schedule') return;
                          const step = ev.key === 'ArrowDown' ? SNAP : ev.key === 'ArrowUp' ? -SNAP : 0;
                          const dayStep = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
                          if (!step && !dayStep) return;
                          ev.preventDefault();
                          onCalEventsChange((list) => list.map((x) => {
                            if (x.id !== e.id) return x;
                            const len = x.end - x.start;
                            const start = Math.min(Math.max(x.start + step, 0), DAY_SPAN - len);
                            const day = Math.min(Math.max(x.day + dayStep, rangeStart), rangeEnd);
                            return { ...x, day, start, end: start + len };
                          }));
                        }}
                        style={{
                          backgroundColor: calColorOf(e),
                          opacity: dragging ? 0.9 : e.eventId === eventId ? 1 : OTHER_EVENT_OPACITY,
                          left: `calc(${(di / cols) * 100}% + 3px)`,
                          width: `calc(${100 / cols}% - 6px)`,
                          top: e.start * HOUR_H + 2,
                          height: (e.end - e.start) * HOUR_H - 4,
                        }}
                        className={`absolute touch-none select-none overflow-hidden rounded-md px-[7px] py-[5px] text-fg-inverse outline-none ${
                          dragging ? 'z-[5] cursor-grabbing shadow-card' : e.source === 'schedule' ? 'z-[3] cursor-pointer' : 'z-[3] cursor-grab transition-[top,left] duration-100'
                        } ${selected ? 'ring-2 ring-fg ring-offset-1' : 'focus-visible:ring-2 focus-visible:ring-fg'}`}
                      >
                        <p className="m-0 flex items-center gap-[4px] text-[10px] font-bold"><span className="size-[4px] rounded-full bg-fg-inverse" />{e.title}</p>
                        {e.end - e.start >= 1 && <p className="m-0 mt-[1px] text-[8.5px] opacity-80">{formatRange(e.start, e.end)}</p>}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
        )}
      </section>

      {calDialog && <CalEventDialog defaultDate={dateOf(anchor)} onClose={() => setCalDialog(false)} onSubmit={addCalEvent} />}

      {peekEvent && (
        <SidePeekPanel
          title={peekEvent.title}
          date={`${dateOf(peekEvent.day).getMonth() + 1}월 ${dateOf(peekEvent.day).getDate()}일 (${['월', '화', '수', '목', '금', '토', '일'][((peekEvent.day % 7) + 7) % 7]})`}
          period={`${dateOf(peekEvent.day).getMonth() + 1}월 ${dateOf(peekEvent.day).getDate()}일 (${['월', '화', '수', '목', '금', '토', '일'][((peekEvent.day % 7) + 7) % 7]}) · ${formatRange(peekEvent.start, peekEvent.end)}`}
          place={place}
          members={members}
          storageKey={`event:${eventId}:${peekEvent.id}`}
          store={peekStore}
          onClose={() => setPeekId(null)}
        />
      )}
    </>
  );
}

/** 주간 캘린더에 표시할 시간 일정을 추가하는 다이얼로그. */
function CalEventDialog({
  defaultDate,
  onClose,
  onSubmit,
}: {
  defaultDate: Date;
  onClose: () => void;
  onSubmit: (title: string, date: string, start: number, end: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => toYMD(defaultDate));
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(1);
  const label = 'flex flex-col gap-[4px] text-sm text-fg-secondary';
  const timeOptions = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => {
      const t = formatClock(h);
      return { value: String(h), label: `${t.text} ${t.ampm}` };
    });
  return (
    <Dialog onClose={onClose}>
      <form
        role="dialog"
        aria-label="일정 추가"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || end <= start) return;
          onSubmit(title.trim(), date, start, end);
        }}
        className="flex w-[400px] max-w-full flex-col gap-[14px] rounded-lg bg-surface p-[20px] shadow-card"
      >
        <h2 className="m-0 text-lg font-semibold text-fg">일정 추가</h2>
        <label className={label}>
          제목
          <Input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 리헤설" className="w-full" />
        </label>
        <label className={label}>
          날짜
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
        </label>
        <div className="flex gap-[12px]">
          <label className={`${label} flex-1`}>
            시작
            <Select
              value={String(start)}
              onChange={(e) => {
                const next = Number(e.target.value);
                setStart(next);
                if (end <= next) setEnd(next + 1);
              }}
              className="w-full"
              options={timeOptions(0, DAY_SPAN - 1)}
            />
          </label>
          <label className={`${label} flex-1`}>
            종료
            <Select value={String(end)} onChange={(e) => setEnd(Number(e.target.value))} className="w-full" options={timeOptions(start + 1, DAY_SPAN)} />
          </label>
        </div>
        <div className="flex justify-end gap-[8px]">
          <button type="button" onClick={onClose} className="h-[32px] rounded-md border border-solid border-border px-[12px] text-base font-medium text-fg-secondary">
            취소
          </button>
          <button type="submit" className="h-[32px] rounded-md bg-brand px-[12px] text-base font-semibold text-fg-inverse disabled:opacity-50" disabled={!title.trim()}>
            추가
          </button>
        </div>
      </form>
    </Dialog>
  );
}
