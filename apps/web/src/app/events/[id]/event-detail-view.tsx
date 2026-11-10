'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Checkbox, SidePeekPanel, SegmentControl, StatusPill, TextTabs, Toggle, type StatusKey } from '@miceplans/ui';
import { ItemAccessContext, resolveOwners, type CheckItem } from './event-checklist';
import type { Invitee, InviteRole } from './invite-dialog';
import type { Team } from './event-products';
import { PART_FILTERS, type PartFilter } from './event-parts';
import { CURRENT_USER, getAssignableNames, isEventMember } from './event-members';
import { getToken } from '../../../lib/api';
import { useGetMe } from '../../../lib/api/generated/endpoints';
import { DEFAULT_FILTER, FilterBar, applyFilter, type ItemFilter } from './event-filter';

/** 하이웍스 소속 이름(`GET /auth/me`의 team). 영상팀·콘텐츠 제작팀도 이 팀의 소분류로 내려온다. */
const DESIGN_TEAM = '디자인팀';

// 탭별 큰 화면은 필요할 때 청크를 받아 첫 행사 상세 진입의 JS를 줄인다.
const ScheduleList = dynamic(() => import('./event-schedule-list').then((module) => module.ScheduleList));
const EventTasks = dynamic(() => import('./event-tasks').then((module) => module.EventTasks));
const EventFiles = dynamic(() => import('./event-files').then((module) => module.EventFiles));
const EventInfoSheet = dynamic(() => import('./event-info-sheet').then((module) => module.EventInfoSheet));
const EventDocs = dynamic(() => import('./event-docs').then((module) => module.EventDocs));
const EventStats = dynamic(() => import('./event-stats').then((module) => module.EventStats));
const InviteDialog = dynamic(() => import('./invite-dialog').then((module) => module.InviteDialog));
const DesignRequestTable = dynamic(() => import('./event-products').then((module) => module.DesignRequestTable));
const ProgressTable = dynamic(() => import('./event-products').then((module) => module.ProgressTable));
const EventMembers = dynamic(() => import('./event-members').then((module) => module.EventMembers));
const VideoSection = dynamic(() => import('./event-video').then((module) => module.VideoSection));

const A = '/assets/event-detail';

type EventInfo = {
  name: string;
  period: string;
  client: string;
  pm: string;
  am: string;
  design: string;
  place: string;
  status: StatusKey;
  dday: string;
  color: string; // 행사 대표색(primary)
};

const EVENTS: Record<string, EventInfo> = {};

/** 행사 정보를 불러오기 전(또는 없을 때) 쓰는 빈 값. */
const EMPTY_EVENT: EventInfo = { name: '행사', period: '', client: '', pm: '', am: '', design: '', place: '', status: '진행중', dday: '', color: '#9aa0a6' };

const CLIENTS: string[] = [];

function ClientSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md px-[8px] py-[4px] text-base text-fg hover:bg-surface-subtle"
      >
        {value || 'Client 선택'}
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 top-full z-20 m-0 mt-[4px] flex max-h-[240px] min-w-[200px] list-none flex-col overflow-auto rounded-xl bg-surface p-[4px] shadow-card">
          {CLIENTS.map((c) => (
            <li key={c} role="option" aria-selected={c === value}>
              <button
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-full rounded-md px-[10px] py-[6px] text-left text-base hover:bg-surface-subtle ${c === value ? 'font-medium text-brand' : 'text-fg'}`}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


/** 스케줄의 children은 할 일, 할 일의 children은 하위 할 일이다. 할 일 탭에서 계층으로 다룬다. */
const INITIAL_SCHEDULE: CheckItem[] = [];

const TABS_BY_TEAM = {
  planning: ['스케줄', '할 일', '문서', '통계', '제작물', '행사 정보', '인력'],
  design: ['스케줄', '할 일', '문서', '통계', '행사 정보', '인력'],
} as const;
type TabName = (typeof TABS_BY_TEAM)['planning'][number];
const MEMBER_TABS: TabName[] = ['인력'];
const DEFAULT_TAB: Record<Team, TabName> = { planning: '제작물', design: '스케줄' };
const PART_OPTIONS = PART_FILTERS.map((p) => ({ value: p, label: p }));

type Task = { title: string; meta: string; done?: boolean };

const COLUMNS: { title: string; dot: string; count: number; badge: string; more: string; moreTone: string; tasks: Task[] }[] = [];

const TODOS: string[] = [];

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

const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
const HOUR_H = 48;
const SNAP = 0.5; // 30분 단위
const DAY_START = 9;
const DAY_SPAN = HOURS.length - 1; // 9시 ~ 20시 중 표시 구간(시간)
const DRAG_THRESHOLD = 4;

type CalEvent = { id: string; eventId: string; day: number; title: string; start: number; end: number };

// 캘린더에는 여러 행사의 일정이 함께 보이며, 블록 색은 소속 행사의 대표색이다.
// 현재 보고 있는 행사가 아닌 블록은 흐리게 처리한다.
const OTHER_EVENT_OPACITY = 0.3;

// day: BASE_MONDAY 기준 일수, start/end: 9시 기준 시간(h)
const INITIAL_EVENTS: CalEvent[] = [];

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

const CARD = 'rounded-xl bg-surface shadow-card';

function Prop({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex h-[32px] items-center gap-[10px] text-base">
      <img alt="" src={`${A}/${icon}.svg`} className="size-[16px]" />
      <span className="w-[90px] shrink-0 text-fg-secondary">{label}</span>
      <span className="text-fg">{children}</span>
    </div>
  );
}

export function EventDetailView({ eventId }: { eventId: string }) {
  const event = EVENTS[eventId] ?? EMPTY_EVENT;
  const [isPublic, setIsPublic] = useState(true);
  const [client, setClient] = useState(event.client);
  // 팀 구분: 하이웍스 소속이 디자인팀(영상팀·콘텐츠 제작팀 포함)이면 디자인팀 화면, 그 밖에는 일반(기획)팀 화면이다.
  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const [team, setTeam] = useState<Team>('planning');
  const [tab, setTab] = useState<TabName>(DEFAULT_TAB.planning);
  const tabs = TABS_BY_TEAM[team];
  const [part, setPart] = useState<PartFilter>('전체');
  const [filter, setFilter] = useState<ItemFilter>(DEFAULT_FILTER);
  // TODO: 개발용 — '권한 없는 사용자로 미리보기'를 켜면 비멤버 화면(인력 탭 숨김)을 확인할 수 있다.
  const [previewNoAccess, setPreviewNoAccess] = useState(false);
  const isMember = !previewNoAccess && isEventMember(event, eventId, CURRENT_USER.name);
  const visibleTabs = isMember ? tabs : tabs.filter((t) => !(MEMBER_TABS as readonly string[]).includes(t));
  const myTeam = me.data?.team;
  useEffect(() => {
    const next: Team = myTeam === DESIGN_TEAM ? 'design' : 'planning';
    setTeam(next);
    setTab(DEFAULT_TAB[next]);
  }, [myTeam]);
  // 멤버 탭을 보고 있을 때 권한이 사라지면(미리보기 토글 등) 기본 탭으로 돌아간다.
  useEffect(() => {
    if (!isMember && tab === '인력') setTab(DEFAULT_TAB[team]);
  }, [isMember, tab, team]);
  // 현재 탭이 보이는 탭 목록에 없으면(탭 이름 변경 직후 등) 기본 탭으로 돌아간다.
  useEffect(() => {
    if (!(visibleTabs as readonly string[]).includes(tab)) setTab(DEFAULT_TAB[team]);
  }, [visibleTabs, tab, team]);
  const assignable = useMemo(() => getAssignableNames({ pm: event.pm, am: event.am, design: event.design }, eventId), [event.pm, event.am, event.design, eventId]);
  const [schedule, setSchedule] = useState(() => resolveOwners(INITIAL_SCHEDULE, assignable));
  const access = useMemo(() => ({ me: CURRENT_USER.name, members: assignable }), [assignable]);
  const [listsLoaded, setListsLoaded] = useState(false);
  const listsKey = `miceplans.event-lists.${eventId}`;

  // 서버 연결 전까지 체크 상태는 브라우저에 저장한다.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(listsKey);
      if (raw) {
        const saved = JSON.parse(raw) as { schedule?: CheckItem[] };
        if (saved.schedule) setSchedule(resolveOwners(saved.schedule, assignable));
      }
    } catch {
      // 저장소를 쓸 수 없으면 기본 데이터로 시작한다.
    }
    setListsLoaded(true);
  }, [listsKey, assignable]);

  useEffect(() => {
    if (!listsLoaded) return;
    try {
      window.localStorage.setItem(listsKey, JSON.stringify({ schedule }));
    } catch {
      // 저장 실패는 화면 상태에만 영향을 주므로 무시한다.
    }
  }, [schedule, listsLoaded, listsKey]);
  const [todos, setTodos] = useState(TODOS.map(() => false));
  const [calView, setCalView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [calEvents, setCalEvents] = useState(INITIAL_EVENTS);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invited, setInvited] = useState<(Invitee & { as: InviteRole })[]>([]);
  const canInvite = CURRENT_USER.name === event.pm;
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; x: number; y: number; origin: CalEvent; moved: boolean } | null>(null);

  const onEventPointerDown = (e: ReactPointerEvent<HTMLDivElement>, ev: CalEvent) => {
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
    const colW = grid.getBoundingClientRect().width / 7;
    const dayDelta = Math.round(dx / colW);
    const timeDelta = Math.round(dy / HOUR_H / SNAP) * SNAP;
    const { origin } = drag;
    const length = origin.end - origin.start;
    const start = Math.min(Math.max(origin.start + timeDelta, 0), DAY_SPAN - length);
    const dayIndex = Math.min(Math.max(origin.day + dayDelta, weekOffset * 7), weekOffset * 7 + 6);
    setCalEvents((list) => list.map((x) => (x.id === drag.id ? { ...x, day: dayIndex, start, end: start + length } : x)));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDraggingId(null);
  };

  const peekEvent = calEvents.find((x) => x.id === peekId) ?? null;
  const weekStart = dateOf(weekOffset * 7);
  const weekEnd = dateOf(weekOffset * 7 + 6);
  const weekLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}~${weekEnd.getDate()}`
      : `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일~${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;

  const scheduleCalendar = (
  <section className={`mt-[16px] flex w-full flex-col gap-[12px] p-[16px] ${CARD}`}>
    <div className="flex items-center gap-[12px] px-[8px] pt-[8px]">
      <button type="button" aria-label="이전 주" onClick={() => setWeekOffset((w) => w - 1)} className="flex size-[24px] items-center justify-center rounded-md hover:bg-surface-chip"><img alt="" src={`${A}/cal-prev.svg`} className="size-[14px]" /></button>
      <h3 className="m-0 text-lg font-semibold text-fg">{weekLabel}</h3>
      <button type="button" aria-label="다음 주" onClick={() => setWeekOffset((w) => w + 1)} className="flex size-[24px] items-center justify-center rounded-md hover:bg-surface-chip"><img alt="" src={`${A}/cal-next.svg`} className="size-[14px]" /></button>
      <button type="button" onClick={() => setWeekOffset(0)} className="h-[24px] rounded-md border border-solid border-border px-[8px] text-xs text-fg-secondary hover:bg-surface-sunken">오늘</button>
      <span className="flex-1" />
      <SegmentControl options={CAL_VIEWS} value={calView} onChange={setCalView} size="sm" />
    </div>

    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))]">
          <div />
          {DAY_NAMES.map((name, di) => {
            const abs = weekOffset * 7 + di;
            const isToday = abs === TODAY_INDEX;
            return (
              <div key={name} className="flex flex-col items-center gap-[2px] pb-[8px] text-center">
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
          <div ref={gridRef} className="relative grid grid-cols-7" onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
            {DAY_NAMES.map((name, di) => {
              const abs = weekOffset * 7 + di;
              return (
                <div
                  key={name}
                  onPointerDown={() => setSelectedId(null)}
                  className={`relative border-0 border-l border-solid border-border-soft ${abs === TODAY_INDEX ? 'bg-error-bg/60' : di >= 5 ? 'bg-surface-sunken' : ''}`}
                >
                  {HOURS.map((h, i) => (
                    <div key={h} style={{ top: i * HOUR_H }} className="pointer-events-none absolute inset-x-0 border-0 border-t border-solid border-border-soft" />
                  ))}
                  {abs === TODAY_INDEX && <div style={{ top: 6.5 * HOUR_H }} className="pointer-events-none absolute inset-x-0 z-[2] h-px bg-error-brand" />}
                </div>
              );
            })}

            {calEvents
              .filter((e) => e.day >= weekOffset * 7 && e.day <= weekOffset * 7 + 6)
              .map((e) => {
                const di = e.day - weekOffset * 7;
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
                    onPointerMove={onEventPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onDoubleClick={() => { endDrag(); setSelectedId(e.id); setPeekId(e.id); }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelectedId(e.id); setPeekId(e.id); }
                      const step = ev.key === 'ArrowDown' ? SNAP : ev.key === 'ArrowUp' ? -SNAP : 0;
                      const dayStep = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
                      if (!step && !dayStep) return;
                      ev.preventDefault();
                      setCalEvents((list) => list.map((x) => {
                        if (x.id !== e.id) return x;
                        const len = x.end - x.start;
                        const start = Math.min(Math.max(x.start + step, 0), DAY_SPAN - len);
                        const day = Math.min(Math.max(x.day + dayStep, weekOffset * 7), weekOffset * 7 + 6);
                        return { ...x, day, start, end: start + len };
                      }));
                    }}
                    style={{
                      backgroundColor: EVENTS[e.eventId]?.color,
                      opacity: dragging ? 0.9 : e.eventId === eventId ? 1 : OTHER_EVENT_OPACITY,
                      left: `calc(${(di / 7) * 100}% + 3px)`,
                      width: `calc(${100 / 7}% - 6px)`,
                      top: e.start * HOUR_H + 2,
                      height: (e.end - e.start) * HOUR_H - 4,
                    }}
                    className={`absolute touch-none select-none overflow-hidden rounded-md px-[7px] py-[5px] text-fg-inverse outline-none ${
                      dragging ? 'z-[5] cursor-grabbing shadow-card' : 'z-[3] cursor-grab transition-[top,left] duration-100'
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
  </section>
  );

  return (
    <div className="flex min-h-full w-full flex-col gap-[20px] bg-surface px-[28px] py-[24px] max-md:px-[16px]">
      <div className="flex flex-col items-start pb-[40px] pt-[44px]">
        <div className="flex w-full items-center gap-[12px]">
          <span aria-hidden style={{ backgroundColor: event.color }} className="h-[33px] w-[9px] shrink-0 rounded-sm" />
          <h1 className="m-0 text-[28px] font-bold text-fg">{event.name}</h1>
          <div className="h-px min-w-px flex-1" />
          <div className="flex items-center gap-[8px]">
            {canInvite && (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="mr-[8px] h-[32px] rounded-sm border border-solid border-border px-[14px] text-base font-medium text-fg-secondary hover:bg-surface-subtle"
              >
                + 멤버 초대
              </button>
            )}
            <span className="whitespace-nowrap text-base text-fg-secondary">Client에게 공개</span>
            <Toggle checked={isPublic} onChange={setIsPublic} ariaLabel="Client 공개 상태 변경" />
          </div>
        </div>

        <div className="flex w-full flex-col py-[16px]">
          <Prop icon="prop-tag" label="상태"><StatusPill status={event.status} /></Prop>
          <Prop icon="prop-client" label="고객사"><ClientSelect value={client} onChange={setClient} /></Prop>
          <Prop icon="prop-person" label="PM">{event.pm}</Prop>
          <Prop icon="prop-person" label="AM">{event.am}</Prop>
          <Prop icon="prop-person" label="디자인">{event.design}</Prop>
          {invited.length > 0 && (
            <Prop icon="prop-person" label="초대됨">
              <span className="flex items-center gap-[8px]">
                {invited.map((p) => (
                  <span key={p.id} className="text-sm">
                    {p.name} · {p.as}
                  </span>
                ))}
              </span>
            </Prop>
          )}
          <Prop icon="prop-period" label="기간">{event.period}</Prop>
          <Prop icon="prop-place" label="장소">{event.place}</Prop>
        </div>

        <div className="flex w-full items-center gap-[10px] pb-[4px]">
          <span className="text-sm font-medium text-fg-secondary">파트</span>
          <SegmentControl options={PART_OPTIONS} value={part} onChange={setPart} size="sm" />
          <span className="flex-1" />
          <label className="flex cursor-pointer items-center gap-[6px] text-xs text-fg-tertiary">
            <Checkbox
              size="sm"
              checked={previewNoAccess}
              onChange={(e) => setPreviewNoAccess(e.target.checked)}
            />
            권한 없는 사용자로 미리보기
          </label>
        </div>

        {team === 'design' && (
          <div className="flex w-full flex-col gap-[16px] pb-[8px]">
            <ProgressTable team="design" part={part} eventId={eventId} />
            <DesignRequestTable team="design" part={part} eventId={eventId} eventName={event.name} />
            <VideoSection eventId={eventId} />
          </div>
        )}

        <TextTabs tabs={visibleTabs} active={tab} onChange={(t) => setTab(t as TabName)} className="mt-[16px]" />

        <ItemAccessContext.Provider value={access}>
        {(tab === '스케줄' || tab === '할 일') && (
          <FilterBar filter={filter} onChange={setFilter} shown={applyFilter(schedule, filter, access.me).length} total={schedule.length} />
        )}
        {tab === '스케줄' && <ScheduleList items={schedule} onChange={(fn) => setSchedule(fn)} part={part} filter={filter} />}
        {tab === '할 일' && <EventTasks schedules={schedule} onChange={(fn) => setSchedule(fn)} part={part} filter={filter} />}
        </ItemAccessContext.Provider>
        {tab === '문서' && <EventFiles eventId={eventId} canManage={event.pm === CURRENT_USER.name || event.am === CURRENT_USER.name} />}
        {tab === '문서' && <EventDocs eventId={eventId} part={part} canManage={event.pm === CURRENT_USER.name || event.am === CURRENT_USER.name} />}
        {tab === '통계' && <EventStats schedule={schedule} tasks={schedule.flatMap((s) => s.children ?? [])} />}
        {tab === '제작물' && (
          <div className="mt-[24px] flex w-full flex-col gap-[24px]">
            <ProgressTable team="planning" part={part} eventId={eventId} />
            <DesignRequestTable team="planning" part={part} eventId={eventId} eventName={event.name} />
            <VideoSection eventId={eventId} />
          </div>
        )}
        {tab === '행사 정보' && <EventInfoSheet eventId={eventId} canEdit={event.pm === CURRENT_USER.name || event.am === CURRENT_USER.name} />}
        {tab === '인력' && isMember && <EventMembers event={event} eventId={eventId} />}
      </div>

      <div className="grid grid-cols-4 gap-[24px] px-[5px] max-lg:grid-cols-2 max-sm:grid-cols-1">
        {COLUMNS.map((c) => (
          <section key={c.title} className={`flex flex-col gap-[8px] p-[14px] ${CARD}`}>
            <div className="mb-[2px] flex items-center gap-[7px]">
              <span className={`size-[8px] rounded-full ${c.dot}`} />
              <h3 className="m-0 text-base font-semibold text-fg">{c.title}</h3>
              <span className="flex-1" />
              <span className={`flex h-[18px] min-w-[26px] items-center justify-center rounded-full px-[6px] text-2xs font-semibold ${c.badge}`}>{c.count}</span>
            </div>
            {c.tasks.map((t) => (
              <div key={t.title} className="flex flex-col gap-[7px] rounded-xl bg-surface-muted px-[11px] py-[10px]">
                <div className="flex items-center gap-[8px]">
                  {t.done ? (
                    <span className="flex size-[17px] shrink-0 items-center justify-center rounded-md bg-success-solid">
                      <img alt="" src={`${A}/check.svg`} className="size-[10px]" />
                    </span>
                  ) : (
                    <span className="size-[17px] shrink-0 rounded-md border-[1.5px] border-solid border-border-strong" />
                  )}
                  <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${t.done ? 'text-fg-secondary' : 'text-fg'}`}>{t.title}</span>
                </div>
                <p className="m-0 flex items-center gap-[5px] text-[10.5px] text-fg-muted">
                  <span className="size-[3px] rounded-full bg-fg-muted" />
                  {t.meta}
                </p>
              </div>
            ))}
            <p className={`m-0 p-[2px] text-[11px] font-semibold ${c.moreTone}`}>{c.more}</p>
          </section>
        ))}
      </div>

      <div className="flex items-stretch gap-[20px] px-[5px] max-lg:flex-col">
        <div
          className="relative flex h-[230px] w-[369px] shrink-0 items-end overflow-hidden rounded-[27px] border-[10px] border-solid border-brand-pink bg-brand-gradient p-[24px] shadow-card max-lg:w-full"
          aria-label={`${event.name} ${event.dday}`}
        >
          <span className="relative z-[2] mr-[-108px] shrink-0 whitespace-nowrap text-[56px] font-bold leading-none tracking-[-0.8px] text-fg-inverse">{event.name}</span>
          <span className="relative z-[1] shrink-0 whitespace-nowrap text-[128px] font-bold leading-[0.9] tracking-[-0.9px] text-fg-inverse/60">{event.dday}</span>
        </div>

        <section className={`flex min-w-0 flex-1 flex-col gap-[24px] p-[24px] ${CARD} rounded-lg`}>
          <h2 className="m-0 text-xl font-semibold text-black">할 일</h2>
          <div className="flex flex-col gap-[8px]">
            {TODOS.map((todo, i) => (
              <label key={i} className="flex h-[37px] cursor-pointer items-center gap-[8px] rounded-md bg-surface-muted px-[11px]">
                <Checkbox
                  className="size-[17px]!"
                  checked={todos[i]}
                  onChange={() => setTodos((v) => v.map((x, j) => (j === i ? !x : x)))}
                />
                <span className={`text-sm font-semibold ${todos[i] ? 'text-fg-tertiary line-through' : 'text-fg'}`}>{todo}</span>
                <span className="flex-1" />
                <span className="text-[10.5px] text-fg-muted">~10/24</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {scheduleCalendar}

      {inviteOpen && (
        <InviteDialog
          eventName={event.name}
          onClose={() => setInviteOpen(false)}
          onInvite={(people, role) => {
            setInvited((v) => [...v, ...people.filter((p) => !v.some((x) => x.id === p.id)).map((p) => ({ ...p, as: role }))]);
            setInviteOpen(false);
          }}
        />
      )}

      {peekEvent && (
        <SidePeekPanel
          title={peekEvent.title}
          date={`${dateOf(peekEvent.day).getMonth() + 1}월 ${dateOf(peekEvent.day).getDate()}일 (${['월', '화', '수', '목', '금', '토', '일'][((peekEvent.day % 7) + 7) % 7]})`}
          period={`${dateOf(peekEvent.day).getMonth() + 1}월 ${dateOf(peekEvent.day).getDate()}일 (${['월', '화', '수', '목', '금', '토', '일'][((peekEvent.day % 7) + 7) % 7]}) · ${formatRange(peekEvent.start, peekEvent.end)}`}
          place={event.place}
          onClose={() => setPeekId(null)}
        />
      )}
    </div>
  );
}
