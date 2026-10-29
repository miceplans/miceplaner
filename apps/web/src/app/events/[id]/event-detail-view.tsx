'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { SidePeekPanel, SegmentControl, StatusPill, TextTabs, Toggle, type StatusKey } from '@miceplans/ui';
import { ItemAccessContext, resolveOwners, type CheckItem } from './event-checklist';
import { ScheduleList } from './event-schedule-list';
import { EventTasks } from './event-tasks';
import { EventDocs } from './event-docs';
import { EventStats } from './event-stats';
import { InviteDialog, type Invitee, type InviteRole } from './invite-dialog';
import { DesignRequestTable, ProgressTable, type Team } from './event-products';
import { PART_FILTERS, type PartFilter } from './event-parts';
import { CURRENT_USER, EventMembers, getAssignableNames, isEventMember } from './event-members';
import { VideoSection } from './event-video';
import { DEFAULT_FILTER, FilterBar, applyFilter, type ItemFilter } from './event-filter';

const A = '/assets/event-detail';

type EventInfo = {
  name: string;
  period: string;
  client: string;
  pm: string;
  am: string;
  design: string;
  video: string;
  place: string;
  status: StatusKey;
  dday: string;
  color: string; // 행사 대표색(primary)
};

const EVENTS: Record<string, EventInfo> = {
  e1: { name: '제54회 KIMES 2025', period: '2025. 03. 13 – 03. 16', client: '메디코리아', pm: '박서연', am: '최민준', design: '이하은', video: '오세민', place: '코엑스 Hall A·B', status: '진행중', dday: 'D-14', color: '#f567a5' },
  e2: { name: '글로벌 AI 서밋 2025', period: '2025. 04. 02 – 04. 03', client: '테크노웨이', pm: '김도현', am: '한지우', design: '오세민', video: '없음', place: '인터컨티넨탈 파르나스', status: '완료', dday: 'D-30', color: '#ffa83f' },
  e3: { name: '삼성 파트너스 데이', period: '2025. 04. 18', client: '삼성전자', pm: '박서연', am: '이준호', design: '윤서준', video: '윤서준', place: '코엑스 오디토리움', status: '진행중', dday: 'D-46', color: '#ffc53d' },
  e4: { name: '제12회 프랜차이즈 엑스포', period: '2025. 05. 08 – 05. 10', client: '프랜차이즈협회', pm: '정유나', am: '최민준', design: '강예린', video: '없음', place: '일산 킨텍스 Hall 1', status: '입찰준비중', dday: 'D-66', color: '#ff7a45' },
  e5: { name: '현대자동차 신차 발표회', period: '2025. 05. 22', client: '현대자동차', pm: '김도현', am: '한지우', design: '이하은', video: '강예린', place: '잠실 롯데월드타워', status: '진행협의중', dday: 'D-80', color: '#ff4c50' },
};

const CLIENTS = ['메디코리아', '글로벌AI서밋 조직위', '삼성전자', '한국프랜차이즈협회', '로진컴퍼니', '테크노웨이', '프랜차이즈협회', '현대자동차'];

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

const c = (id: string, title: string, done = false): CheckItem => ({ id, title, done });

/** 스케줄의 children은 할 일, 할 일의 children은 하위 할 일이다. 할 일 탭에서 계층으로 다룬다. */
const INITIAL_SCHEDULE: CheckItem[] = [
  { id: 's1', title: '홈페이지 오픈', done: true, date: '02.24', owner: '박', part: '디자인', children: [c('s1a', '디자인 확정', true), c('s1b', '퍼블리싱', true), c('s1c', '오픈 점검', true)] },
  { id: 's2', title: '초청장 발송', done: true, date: '03.03', owner: '최', children: [c('s2a', '명단 확정', true), c('s2b', '시안 제작', true), c('s2c', '발송', true), { id: 't3', title: '초청장 발송 대상 검토', done: true, date: '3월 8일', owner: '김' }] },
  { id: 's3', title: '브로슈어 인쇄', done: false, late: true, date: '03.06', owner: '한', part: '디자인', children: [c('s3a', '원고 확정', true), c('s3b', '인쇄소 발주', true), c('s3c', '최종 교정'), { id: 't1', title: '브로슈어 인쇄 최종 확인', done: false, date: '오늘', owner: '박', children: [c('t1a', '색상 교정', true), c('t1b', '사이즈 확인', true), c('t1c', '입고 일정 확인')] }] },
  { id: 's4', title: '디자인 승인', done: true, date: '03.05', owner: '박', part: '디자인' },
  { id: 's5', title: '리허설', done: false, date: '03.12', owner: '최', part: '영상', children: [c('s5a', '동선 점검'), c('s5b', '음향 테스트')] },
  { id: 's6', title: '행사 당일 운영', done: false, date: '03.13 – 03.16', owner: '박', children: [{ id: 't2', title: '참가 업체 부스 배치 확정', done: false, date: '3월 7일', owner: '최', children: [c('t2a', '업체 의견 취합', true), c('t2b', '도면 수정'), c('t2c', '최종 승인')] }, { id: 't4', title: '운영 인력 배치표 공유', done: false, date: '3월 10일', owner: '박' }] },
];

const TABS_BY_TEAM = {
  planning: ['스케줄', '할 일', '문서', '통계', '제작물', '인력'],
  design: ['스케줄', '할 일', '문서', '통계', '인력'],
} as const;
type TabName = (typeof TABS_BY_TEAM)['planning'][number];
const MEMBER_TABS: TabName[] = ['인력'];
const DEFAULT_TAB: Record<Team, TabName> = { planning: '제작물', design: '스케줄' };
const PART_OPTIONS = PART_FILTERS.map((p) => ({ value: p, label: p }));

type Task = { title: string; meta: string; done?: boolean };

const COLUMNS: { title: string; dot: string; count: number; badge: string; more: string; moreTone: string; tasks: Task[] }[] = [
  {
    title: '진행', dot: 'bg-brand-blue', count: 5, badge: 'bg-info-bg text-info', more: '+ 3 more', moreTone: 'text-error-delay',
    tasks: [
      { title: 'Onboarding flow v2', meta: 'Due Today · 4 comments' },
      { title: 'Mobile navigation', meta: 'Due Wednesday' },
    ],
  },
  {
    title: '편집', dot: 'bg-brand-pink', count: 2, badge: 'bg-error-bg text-error', more: '+ 2 more', moreTone: 'text-error-delay',
    tasks: [
      { title: 'Brand guidelines', meta: 'Due Today' },
      { title: 'Case study · Acme', meta: 'Due Monday' },
    ],
  },
  {
    title: '완료', dot: 'bg-success-solid', count: 8, badge: 'bg-success-bg text-success-deep', more: '+ 6 more', moreTone: 'text-success-deep',
    tasks: [
      { title: 'Pricing page revamp', meta: 'Shipped May 12', done: true },
      { title: 'Design tokens v1.2', meta: 'Shipped May 10', done: true },
    ],
  },
  {
    title: '보류', dot: 'bg-fg-tertiary', count: 3, badge: 'bg-surface-chip text-fg-secondary', more: '+ 5 more', moreTone: 'text-fg-secondary',
    tasks: [
      { title: 'Website copy rewrite', meta: 'Due Tomorrow' },
      { title: 'Q3 research plan', meta: 'Due Friday' },
    ],
  },
];

const TODOS = ['연사자 정리', '연사자 정리', '연사자 정리'];

const CAL_VIEWS = [
  { value: 'Day', label: 'Day' },
  { value: 'Week', label: 'Week' },
  { value: 'Month', label: 'Month' },
] as const;

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const BASE_MONDAY = new Date(2026, 9, 12); // 디자인 기준 주(10월 12~18)
const TODAY_INDEX = 2; // BASE_MONDAY 기준 오늘(수요일)
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
const INITIAL_EVENTS: CalEvent[] = [
  { id: 'c1', eventId: 'e1', day: 0, title: 'Design Review', start: 1, end: 2.5 },
  { id: 'c2', eventId: 'e2', day: 0, title: 'Team Sync', start: 5, end: 6 },
  { id: 'c3', eventId: 'e2', day: 1, title: 'Sprint Planning', start: 0.5, end: 2 },
  { id: 'c4', eventId: 'e3', day: 1, title: 'Client Call', start: 4, end: 5.5 },
  { id: 'c5', eventId: 'e5', day: 1, title: '1:1 · Sara', start: 7, end: 8 },
  { id: 'c6', eventId: 'e3', day: 2, title: 'Standup', start: 0, end: 1 },
  { id: 'c7', eventId: 'e5', day: 2, title: 'UX Workshop', start: 2, end: 4 },
  { id: 'c8', eventId: 'e1', day: 2, title: 'Roadmap Review', start: 6, end: 7.5 },
  { id: 'c9', eventId: 'e2', day: 3, title: 'Design Critique', start: 1.5, end: 3 },
  { id: 'c10', eventId: 'e4', day: 3, title: 'Interview · FE', start: 5, end: 6.5 },
  { id: 'c11', eventId: 'e4', day: 4, title: 'Retro', start: 0, end: 1 },
  { id: 'c12', eventId: 'e1', day: 4, title: 'Demo Day', start: 2, end: 3 },
  { id: 'c13', eventId: 'e2', day: 4, title: 'Design Sprint', start: 5, end: 7 },
  { id: 'c14', eventId: 'e5', day: 5, title: 'Team Lunch', start: 2.5, end: 4 },
];

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
  const event = EVENTS[eventId] ?? EVENTS.e1;
  const [isPublic, setIsPublic] = useState(true);
  const [client, setClient] = useState(event.client);
  // TODO: 팀 구분 기준(역할·소속)이 확정되면 인증 정보에서 가져온다. 그전에는 ?team=design 으로 디자인팀 화면을 본다.
  const [team, setTeam] = useState<Team>('planning');
  const [tab, setTab] = useState<TabName>(DEFAULT_TAB.planning);
  const tabs = TABS_BY_TEAM[team];
  const [part, setPart] = useState<PartFilter>('전체');
  const [filter, setFilter] = useState<ItemFilter>(DEFAULT_FILTER);
  // TODO: 개발용 — '권한 없는 사용자로 미리보기'를 켜면 비멤버 화면(인력 탭 숨김)을 확인할 수 있다.
  const [previewNoAccess, setPreviewNoAccess] = useState(false);
  const isMember = !previewNoAccess && isEventMember(event, eventId, CURRENT_USER.name);
  const visibleTabs = isMember ? tabs : tabs.filter((t) => !(MEMBER_TABS as readonly string[]).includes(t));
  useEffect(() => {
    const next: Team = new URLSearchParams(window.location.search).get('team') === 'design' ? 'design' : 'planning';
    setTeam(next);
    setTab(DEFAULT_TAB[next]);
  }, []);
  // 멤버 탭을 보고 있을 때 권한이 사라지면(미리보기 토글 등) 기본 탭으로 돌아간다.
  useEffect(() => {
    if (!isMember && tab === '인력') setTab(DEFAULT_TAB[team]);
  }, [isMember, tab, team]);
  // 현재 탭이 보이는 탭 목록에 없으면(탭 이름 변경 직후 등) 기본 탭으로 돌아간다.
  useEffect(() => {
    if (!(visibleTabs as readonly string[]).includes(tab)) setTab(DEFAULT_TAB[team]);
  }, [visibleTabs, tab, team]);
  const assignable = useMemo(() => getAssignableNames({ pm: event.pm, am: event.am, design: event.design, video: event.video }, eventId), [event.pm, event.am, event.design, event.video, eventId]);
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
          <Prop icon="prop-client" label="Client"><ClientSelect value={client} onChange={setClient} /></Prop>
          <Prop icon="prop-person" label="PM">{event.pm}</Prop>
          <Prop icon="prop-person" label="AM">{event.am}</Prop>
          <Prop icon="prop-person" label="Design">{event.design}</Prop>
          <Prop icon="prop-person" label="영상">{event.video}</Prop>
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
            <input
              type="checkbox"
              checked={previewNoAccess}
              onChange={(e) => setPreviewNoAccess(e.target.checked)}
              className="size-[14px] accent-brand"
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
        {tab === '문서' && <EventDocs eventId={eventId} part={part} canManage={event.pm === CURRENT_USER.name || event.am === CURRENT_USER.name} />}
        {tab === '통계' && <EventStats schedule={schedule} tasks={schedule.flatMap((s) => s.children ?? [])} />}
        {tab === '제작물' && (
          <div className="mt-[24px] flex w-full flex-col gap-[24px]">
            <ProgressTable team="planning" part={part} eventId={eventId} />
            <DesignRequestTable team="planning" part={part} eventId={eventId} eventName={event.name} />
            <VideoSection eventId={eventId} />
          </div>
        )}
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
          aria-label={`BIPC ${event.dday}`}
        >
          <span className="relative z-[2] mr-[-108px] shrink-0 whitespace-nowrap text-[56px] font-bold leading-none tracking-[-0.8px] text-fg-inverse">BIPC</span>
          <span className="relative z-[1] shrink-0 whitespace-nowrap text-[128px] font-bold leading-[0.9] tracking-[-0.9px] text-fg-inverse/60">{event.dday}</span>
        </div>

        <section className={`flex min-w-0 flex-1 flex-col gap-[24px] p-[24px] ${CARD} rounded-lg`}>
          <h2 className="m-0 text-xl font-semibold text-black">할 일</h2>
          <div className="flex flex-col gap-[8px]">
            {TODOS.map((todo, i) => (
              <label key={i} className="flex h-[37px] cursor-pointer items-center gap-[8px] rounded-md bg-surface-muted px-[11px]">
                <input
                  type="checkbox"
                  checked={todos[i]}
                  onChange={() => setTodos((v) => v.map((x, j) => (j === i ? !x : x)))}
                  className="size-[17px] accent-brand"
                />
                <span className={`text-sm font-semibold ${todos[i] ? 'text-fg-tertiary line-through' : 'text-fg'}`}>{todo}</span>
                <span className="flex-1" />
                <span className="text-[10.5px] text-fg-muted">~10/24</span>
              </label>
            ))}
          </div>
        </section>

        <section className={`flex w-[272px] shrink-0 flex-col gap-[24px] p-[24px] ${CARD} rounded-lg max-lg:w-full`}>
          <h2 className="m-0 text-xl font-semibold text-black">새 알림</h2>
          <div className="rounded-md bg-surface-muted px-[11px] py-[10px] text-sm font-semibold text-fg">[BIPC] 포스터 변경 부탁드립니다.</div>
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
