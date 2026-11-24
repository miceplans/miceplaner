'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { dDayLabel } from '@miceplans/domain';
import { Checkbox, Dialog, Input, Select, SidePeekPanel, SegmentControl, StatusPill, TextTabs, Toggle, toast, type StatusKey } from '@miceplans/ui';
import { ItemAccessContext, normalizeTree, resolveOwners, toggleItem, type CheckItem } from './event-checklist';

/** 상단 '할 일' 카드 항목. local은 이 기기에 저장된 스케줄 하위 할 일이다. */
type OpenTodo = { id: string; title: string; due?: string; local: boolean };
import type { Invitee, InviteRole } from './invite-dialog';
import type { RequestRow, Team } from './event-products';
import { PART_FILTERS, type PartFilter } from './event-parts';
import { CURRENT_USER, getAssignableNames, isEventMember } from './event-members';
import { getToken, ApiError } from '../../../lib/api';
import {
  getEventItemsListQueryKey,
  getEventsClientsQueryKey,
  getEventsListQueryKey,
  getEventsMembersQueryKey,
  getEventsGetQueryKey,
  useClientAccountsList,
  useDirectoryUsers,
  useEventItemsList,
  useEventsAddMember,
  useEventsAssignClient,
  useEventsClients,
  useEventsGet,
  useEventsMembers,
  useEventsSetPublicVisibility,
  useEventsUnassignClient,
  useGetMe,
  useItemsUpdate,
} from '../../../lib/api/generated/endpoints';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_FILTER, FilterBar, applyFilter, type ItemFilter } from './event-filter';
import { PmTransfer } from './pm-transfer';
import { LeadSelect } from './lead-select';
import { StatusSelect } from './status-select';
import { TaskBoard } from './task-board-view';
import { useScheduleNoteStore } from '../../schedule-calendar/schedule-note-store';
import type { EventListItemDto } from '@miceplans/contracts';
import { setEventItems, setEventTab } from '../../ai-chat/event-context';

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

/** 목업 데이터가 비어 있을 때(정적 프리렌더 포함) 보여 줄 빈 값이다. */
const FALLBACK_EVENT: EventInfo = { name: '행사', period: '', client: '', pm: '', am: '', design: '', place: '', status: '진행중', dday: '', color: '#9aa0a6' };

/** 행사에 지정할 Client 계정 선택창. 목록은 Client 계정 API에서 가져온다. */
function ClientSelect({
  value,
  accounts,
  onChange,
}: {
  /** 현재 표시 이름(지정된 Client가 없으면 빈 값). */
  value: string;
  accounts: { id: string; name: string; companyName: string | null }[];
  onChange: (accountId: string | null) => void;
}) {
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
          {value ? (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="w-full rounded-md px-[10px] py-[6px] text-left text-base text-fg-tertiary hover:bg-surface-subtle"
              >
                지정 안 함
              </button>
            </li>
          ) : null}
          {accounts.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full rounded-md px-[10px] py-[6px] text-left text-base hover:bg-surface-subtle ${c.name === value ? 'font-medium text-brand' : 'text-fg'}`}
              >
                {c.companyName || c.name}
              </button>
            </li>
          ))}
          {!accounts.length && <li className="px-[10px] py-[6px] text-base text-fg-tertiary">등록된 Client 계정이 없습니다.</li>}
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

type CalEvent = { id: string; eventId: string; day: number; title: string; start: number; end: number; source?: 'calendar' | 'schedule' };

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

/** 실제 행사 정보를 화면 표시 형식으로 바꾼다. */
function toEventInfo(real: EventListItemDto): EventInfo {
  const fmt = (d: string) => d.split('-').join('. ');
  return {
    name: real.name,
    period: real.startDate === real.endDate ? fmt(real.startDate) : `${fmt(real.startDate)} – ${fmt(real.endDate)}`,
    client: real.clientName ?? '(삭제된 고객사)',
    pm: real.pmName ?? '',
    am: real.amName ?? '',
    design: real.designName ?? '',
    place: real.place,
    status: real.status,
    // 시작일만 보면 진행 중인 행사도 '종료'로 보여서 종료일까지 함께 본다.
    dday: dDayLabel(new Date(`${real.startDate}T00:00:00`), new Date(), new Date(`${real.endDate}T00:00:00`)),
    color: real.color ?? '#f567a5',
  };
}

export function EventDetailView() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState('');
  useEffect(() => {
    setEventId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);
  // 목업 id(e1~e5)처럼 API에 없는 행사는 조회 실패로 data가 비어 기존 목업 데이터를 쓴다.
  // 메인 목록에서 들어오면 목록 캐시의 같은 행사로 바로 그리고, 목록의 신선도(staleTime)를 그대로 따라 중복 요청을 피한다.
  const eventQuery = useEventsGet(eventId, {
    query: {
      enabled: eventId !== '',
      initialData: () => queryClient.getQueryData<EventListItemDto[]>(getEventsListQueryKey())?.find((e) => e.id === eventId),
      initialDataUpdatedAt: () => queryClient.getQueryState(getEventsListQueryKey())?.dataUpdatedAt,
    },
  });
  const real = eventQuery.data ?? null;
  // 실제 멤버십으로 인력 탭·PM 넘기기 노출을 결정한다. 목업 행사(API에 없는 id)는 기존 목업 판정을 쓴다.
  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const meId = me.data?.id ?? null;
  // 실데이터 판정이 불가능(목업 행사 등)하면 조회가 실패해 isSuccess=false로, 목업 판정을 쓰게 한다.
  const members = useEventsMembers(eventId, { query: { enabled: eventId !== '' && meId !== null } });
  const myRole = useMemo(() => members.data?.find((m) => m.userId === meId)?.role ?? null, [members.data, meId]);
  const roleResolved = members.isSuccess;
  const event: EventInfo = useMemo(() => (real ? toEventInfo(real) : EVENTS[eventId] ?? FALLBACK_EVENT), [real, eventId]);
  const [isPublic, setIsPublic] = useState(true);
  // Client 지정·해제는 감사 로그 대상 API를 쓴다. 지정된 Client 계정과 전체 Client 계정 목록으로 선택창을 채운다.
  const canManageClients = roleResolved ? myRole === 'pm' || myRole === 'am' : event.pm === CURRENT_USER.name || event.am === CURRENT_USER.name;
  const clientAccounts = useClientAccountsList({ query: { enabled: getToken() !== null } });
  const assignedClients = useEventsClients(eventId, { query: { enabled: eventId !== '' && canManageClients && getToken() !== null } });
  const assignedClientId = assignedClients.data?.[0] ?? null;
  const clientLabel = (() => {
    const account = (clientAccounts.data ?? []).find((a) => a.id === assignedClientId);
    return account ? account.companyName || account.name : event.client;
  })();
  const assignClient = useEventsAssignClient();
  const unassignClient = useEventsUnassignClient();
  const refreshClients = () => {
    void queryClient.invalidateQueries({ queryKey: getEventsClientsQueryKey(eventId) });
    void queryClient.invalidateQueries({ queryKey: getEventsListQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getEventsGetQueryKey(eventId) });
  };
  const changeClient = (accountId: string | null) => {
    if (!eventId) return;
    if (!canManageClients) {
      toast.error('Client 지정은 PM·AM만 할 수 있습니다.');
      return;
    }
    const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : '[500] Client 지정에 실패했습니다.');
    if (accountId === null) {
      if (!assignedClientId) return;
      unassignClient.mutate({ id: eventId, userId: assignedClientId }, { onSuccess: refreshClients, onError: fail });
    } else {
      if (accountId === assignedClientId) return;
      assignClient.mutate({ id: eventId, userId: accountId }, { onSuccess: refreshClients, onError: fail });
    }
  };
  // 비로그인 공개 캘린더 노출. 실제 행사에서 PM·AM만 바꾸며, 서버가 version을 검사하고 감사 로그를 남긴다 (명세 F-07).
  const setPublicVisibility = useEventsSetPublicVisibility();
  const changePublicVisible = (next: boolean) => {
    if (!real) return;
    if (!canManageClients) {
      toast.error('공개 캘린더 노출은 PM·AM만 바꿀 수 있습니다.');
      return;
    }
    setPublicVisibility.mutate(
      { id: real.id, data: { publicVisible: next, version: real.version } },
      {
        onSuccess: refreshClients,
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            toast.error('다른 사람이 먼저 행사를 바꿨습니다. 최신 상태를 불러왔으니 다시 확인해 주세요.');
            refreshClients();
            return;
          }
          toast.error(error instanceof ApiError ? error.message : '[500] 공개 상태 변경에 실패했습니다.');
        },
      },
    );
  };
  // TODO: 팀 구분 기준(역할·소속)이 확정되면 인증 정보에서 가져온다. 그전에는 ?team=design 으로 디자인팀 화면을 본다.
  const [team, setTeam] = useState<Team>('planning');
  const [tab, setTab] = useState<TabName>(DEFAULT_TAB.planning);
  const tabs = TABS_BY_TEAM[team];
  const [part, setPart] = useState<PartFilter>('전체');
  const [filter, setFilter] = useState<ItemFilter>(DEFAULT_FILTER);
  // 실데이터에서 멤버십이 확인되면 그 결과를 쓰고, 목업 행사에서는 기존 목업 판정을 쓴다.
  const isMember = roleResolved ? myRole !== null : isEventMember(event, eventId, CURRENT_USER.name);
  // AI 에이전트가 사용자가 보고 있는 탭을 맥락으로 쓰게 한다.
  useEffect(() => {
    setEventTab(tab);
    return () => setEventTab(undefined);
  }, [tab]);
  const visibleTabs = isMember ? tabs : tabs.filter((t) => !(MEMBER_TABS as readonly string[]).includes(t));
  const myTeam = me.data?.team;
  useEffect(() => {
    const next: Team = myTeam === DESIGN_TEAM ? 'design' : 'planning';
    // GET /auth/me는 첫 렌더 뒤에 도착한다. 같은 팀 값이 다시 들어올 때까지 매번
    // 기본 탭(기획팀: 제작물)으로 돌리면 사용자가 고른 탭이 사라진다.
    setTeam((current) => {
      if (current === next) return current;
      setTab(DEFAULT_TAB[next]);
      return next;
    });
  }, [myTeam]);
  // 멤버 탭을 보고 있을 때 권한이 사라지면 기본 탭으로 돌아간다.
  useEffect(() => {
    if (!isMember && tab === '인력') setTab(DEFAULT_TAB[team]);
  }, [isMember, tab, team]);
  // 현재 탭이 보이는 탭 목록에 없으면(탭 이름 변경 직후 등) 기본 탭으로 돌아간다.
  useEffect(() => {
    if (!(visibleTabs as readonly string[]).includes(tab)) setTab(DEFAULT_TAB[team]);
  }, [visibleTabs, tab, team]);
  const users = useDirectoryUsers({ query: { enabled: getToken() !== null, staleTime: 60_000 } });
  // 업무 담당자 후보: 담당 인력(PM·AM·디자인)과 멤버 API로 확인된 행사 멤버.
  const assignable = useMemo(() => {
    const memberNames = (members.data ?? [])
      .map((m) => (users.data ?? []).find((u) => u.id === m.userId)?.name)
      .filter((name): name is string => !!name);
    return [...new Set([...getAssignableNames({ pm: event.pm, am: event.am, design: event.design }, eventId), ...memberNames])];
  }, [members.data, users.data, event.pm, event.am, event.design, eventId]);
  const [schedule, setSchedule] = useState(() => resolveOwners(INITIAL_SCHEDULE, assignable));
  const [products, setProducts] = useState<RequestRow[]>([]);
  // AI 에이전트가 화면의 스케줄·할 일(브라우저에만 저장)을 볼 수 있게 한다.
  useEffect(() => {
    setEventItems(schedule);
    return () => setEventItems(undefined);
  }, [schedule]);
  const [calView, setCalView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [calDialog, setCalDialog] = useState(false);
  const access = useMemo(() => ({ me: CURRENT_USER.name, members: assignable }), [assignable]);
  // 저장값은 행사 키가 바뀔 때만 읽는다. eventId가 빈 값(첫 렌더)이면 저장 자체를 건드리지 않고,
  // 담당자 정보가 늦게 도착해도 읽기를 반복하지 않아 편집 중인 상태를 덮지 않는다.
  const listsKey = eventId ? `miceplans.event-lists.${eventId}` : null;
  const [listsLoadedKey, setListsLoadedKey] = useState<string | null>(null);
  const assignableRef = useRef(assignable);
  assignableRef.current = assignable;

  // 서버 연결 전까지 체크 상태는 브라우저에 저장한다.
  useEffect(() => {
    if (!listsKey) return;
    try {
      const raw = window.localStorage.getItem(listsKey);
      if (raw) {
        const saved = JSON.parse(raw) as { schedule?: CheckItem[]; calEvents?: CalEvent[] };
        if (saved.schedule) setSchedule(normalizeTree(resolveOwners(saved.schedule, assignableRef.current)));
        if (Array.isArray((saved as { products?: RequestRow[] }).products)) setProducts((saved as { products: RequestRow[] }).products);
        if (Array.isArray(saved.calEvents)) setCalEvents(saved.calEvents);
      } else {
        // 저장값이 없으면 이전 행사 데이터가 새 키로 흘러가지 않게 비운다.
        setSchedule(resolveOwners(INITIAL_SCHEDULE, assignableRef.current));
        setProducts([]);
        setCalEvents([]);
      }
    } catch {
      // 저장소를 쓸 수 없으면 기본 데이터로 시작한다.
    }
    setListsLoadedKey(listsKey);
  }, [listsKey]);

  // 멤버 정보가 늦게 확인되면 저장값을 다시 읽지 않고 지금 트리의 소유자만 다시 맞춘다.
  useEffect(() => {
    setSchedule((current) => resolveOwners(current, assignable));
  }, [assignable]);

  // 타이핑·드래그마다 디스크에 쓰지 않도록 마지막 변경만 잠시 뒤에 저장하고, 페이지를 떠날 때 즉시 비운다.
  const pendingLists = useRef<{ key: string; timer: number; schedule: CheckItem[]; products: RequestRow[]; calEvents: CalEvent[] } | null>(null);
  const flushLists = useCallback(() => {
    const pending = pendingLists.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingLists.current = null;
    try {
      window.localStorage.setItem(pending.key, JSON.stringify({ schedule: pending.schedule, products: pending.products, calEvents: pending.calEvents }));
    } catch {
      // 저장 실패는 화면 상태에만 영향을 주므로 무시한다.
    }
  }, []);
  useEffect(() => {
    if (!listsKey || listsLoadedKey !== listsKey) return;
    if (pendingLists.current) window.clearTimeout(pendingLists.current.timer);
    pendingLists.current = { key: listsKey, schedule, products, calEvents, timer: window.setTimeout(flushLists, 400) };
  }, [schedule, products, calEvents, listsKey, listsLoadedKey, flushLists]);
  useEffect(() => {
    window.addEventListener('pagehide', flushLists);
    return () => {
      window.removeEventListener('pagehide', flushLists);
      flushLists();
    };
  }, [flushLists]);
  // '할 일' 카드: 행사 항목 중 상위 할 일을 마감일 순으로 보여주고, 체크하면 완료 처리한다.
  const eventItems = useEventItemsList(eventId, undefined, { query: { enabled: eventId !== '' && getToken() !== null } });
  const updateItem = useItemsUpdate();
  // 할 일 탭에서 추가한 항목은 스케줄 하위 할 일로 이 기기에 저장되므로(업무 보드와 같은 기준) 서버 Task와 함께 보여 준다.
  const openTodos = useMemo(() => {
    const server: OpenTodo[] = (eventItems.data ?? [])
      .filter((it) => it.kind === 'task' && it.status !== '완료' && it.status !== '취소')
      .map((it) => ({ id: it.id, title: it.title, due: it.dueOn ?? undefined, local: false }));
    const local: OpenTodo[] = [];
    const visit = (items: CheckItem[], depth: number) => {
      for (const item of items) {
        if (depth > 0 && !item.done && item.workflowStatus !== '완료') local.push({ id: item.id, title: item.title, due: item.date, local: true });
        if (item.children?.length) visit(item.children, depth + 1);
      }
    };
    visit(schedule, 0);
    return [...server, ...local].sort((a, b) => (a.due ?? '9999-12-31').localeCompare(b.due ?? '9999-12-31')).slice(0, 8);
  }, [eventItems.data, schedule]);
  const completeTodo = (todo: OpenTodo) => {
    if (todo.local) {
      const next = toggleItem(schedule, todo.id, access.me);
      if (next === schedule) toast.error('담당자나 만든 사람만 완료할 수 있습니다.');
      else setSchedule(next);
      return;
    }
    const itemId = todo.id;
    updateItem.mutate(
      { id: itemId, data: { status: '완료' } },
      {
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: getEventItemsListQueryKey(eventId) }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : '[500] 완료 처리에 실패했습니다.'),
      },
    );
  };
  // 캘린더가 가리키는 날(BASE_MONDAY 기준 일수). Day/Week/Month 모두 이 날을 기준으로 표시 구간을 정한다.
  const [anchor, setAnchor] = useState(TODAY_INDEX);
  // 보기와 기준 날짜를 저장해 새로고침 후에도 유지한다. 기준 날짜는 YYYY-MM-DD 절대 날짜로 저장해 주가 바뀌어도 어긋나지 않게 한다.
  const CAL_PREFS_KEY = 'miceplans.event-detail.calendar';
  const [calPrefsLoaded, setCalPrefsLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CAL_PREFS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        const prefs = parsed as { view?: unknown; anchorDate?: unknown };
        if (prefs.view === 'Day' || prefs.view === 'Week' || prefs.view === 'Month') setCalView(prefs.view);
        if (typeof prefs.anchorDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(prefs.anchorDate)) {
          const [y, m, d] = prefs.anchorDate.split('-').map(Number);
          setAnchor(absOf(new Date(y!, m! - 1, d!)));
        }
      }
    } catch {
      /* 저장값이 깨져 있으면 기본값으로 둔다. */
    }
    setCalPrefsLoaded(true);
  }, []);
  const anchorIsoOf = (abs: number) => {
    const date = dateOf(abs);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  useEffect(() => {
    if (!calPrefsLoaded) return;
    try {
      window.localStorage.setItem(CAL_PREFS_KEY, JSON.stringify({ view: calView, anchorDate: anchorIsoOf(anchor) }));
    } catch {
      /* 저장 실패는 화면 상태에만 영향을 주므로 무시한다. */
    }
  }, [calView, anchor, calPrefsLoaded]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const peekStore = useScheduleNoteStore(eventId || null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invited, setInvited] = useState<(Invitee & { as: InviteRole })[]>([]);
  const addMember = useEventsAddMember();
  // 초대 확정: 고른 사람을 행사 멤버로 등록한다(AM·스태프). 성공하면 멤버 목록을 다시 받는다.
  const inviteMembers = (people: Invitee[], role: InviteRole) => {
    if (!eventId || !people.length) return;
    const bodyRole = role === 'AM' ? 'am' : 'member';
    let remaining = people.length;
    const settle = () => {
      remaining -= 1;
      if (remaining === 0) void queryClient.invalidateQueries({ queryKey: getEventsMembersQueryKey(eventId) });
    };
    for (const p of people) {
      addMember.mutate(
        { id: eventId, data: { userId: p.id, role: bodyRole } },
        {
          onSuccess: () => {
            settle();
            toast.info(`${p.name} 님을 초대했습니다.`);
          },
          onError: (error) => {
            settle();
            toast.error(error instanceof ApiError ? error.message : `[500] ${p.name} 님 초대에 실패했습니다.`);
          },
        },
      );
    }
  };
  const canInvite = roleResolved ? myRole === 'pm' : CURRENT_USER.name === event.pm;
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
    setCalEvents((list) => list.map((x) => (x.id === drag.id ? { ...x, day: dayIndex, start, end: start + length } : x)));
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
    if (calView === 'Day') setAnchor((a) => a + dir);
    else if (calView === 'Week') setAnchor((a) => a + dir * 7);
    else setAnchor(absOf(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1)));
  };
  // 다른 행사 블록의 색은 알 수 없으니 회색으로 두고, 지금 행사만 대표색을 쓴다.
  const calColorOf = (e: CalEvent) => (e.eventId === eventId ? event.color : '#9aa0a6');
  const addCalEvent = (title: string, date: string, start: number, end: number) => {
    const day = absOf(new Date(`${date}T00:00:00`));
    setCalEvents((list) => [...list, { id: `n${Date.now()}`, eventId, day, title, start, end }]);
    setAnchor(day);
    setCalDialog(false);
  };

  const scheduleCalendar = (
  <section className={`mt-[16px] flex w-full flex-col gap-[12px] p-[16px] ${CARD}`}>
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
                      setCalEvents((list) => list.map((x) => {
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
            {real && (
              <>
                <span className="whitespace-nowrap text-base text-fg-secondary" title="로그인하지 않은 방문자에게 고객 포털 캘린더에서 행사명과 기간을 보여 줍니다">공개 캘린더</span>
                <Toggle checked={real.publicVisible} onChange={changePublicVisible} ariaLabel="비로그인 공개 캘린더 노출 변경" />
                <span aria-hidden className="mx-[4px] h-[16px] w-px bg-border-strong" />
              </>
            )}
            <span className="whitespace-nowrap text-base text-fg-secondary">Client에게 공개</span>
            <Toggle checked={isPublic} onChange={setIsPublic} ariaLabel="Client 공개 상태 변경" />
          </div>
        </div>

        <div className="flex w-full flex-col py-[16px]">
          <Prop icon="prop-tag" label="상태">
            {real ? <StatusSelect eventId={real.id} status={event.status} canChange={canManageClients} /> : <StatusPill status={event.status} />}
          </Prop>
          <Prop icon="prop-client" label="고객사"><ClientSelect value={clientLabel} accounts={clientAccounts.data ?? []} onChange={changeClient} /></Prop>
          <Prop icon="prop-person" label="PM">{event.pm}</Prop>
          <Prop icon="prop-person" label="AM">
            {real ? <LeadSelect eventId={eventId} role="am" label={event.am} members={members.data} users={users.data} canManage={canManageClients} /> : event.am}
          </Prop>
          <Prop icon="prop-person" label="디자인">
            {real ? <LeadSelect eventId={eventId} role="design" label={event.design} members={members.data} users={users.data} canManage={canManageClients} /> : event.design}
          </Prop>
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
        </div>

        {team === 'design' && (
          <div className="flex w-full flex-col gap-[16px] pb-[8px]">
            <ProgressTable team="design" part={part} eventId={eventId} rows={products} />
            <DesignRequestTable team="design" part={part} eventId={eventId} eventName={event.name} rows={products} onRowsChange={setProducts} />
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
        {tab === '문서' && <EventFiles eventId={eventId} canManage={canManageClients} />}
        {tab === '문서' && <EventDocs eventId={eventId} part={part} canManage={event.pm === CURRENT_USER.name || event.am === CURRENT_USER.name} />}
        {tab === '통계' && <EventStats schedule={schedule} tasks={schedule.flatMap((s) => s.children ?? [])} />}
        {tab === '제작물' && (
          <div className="mt-[24px] flex w-full flex-col gap-[24px]">
            <ProgressTable team="planning" part={part} eventId={eventId} rows={products} />
            <DesignRequestTable team="planning" part={part} eventId={eventId} eventName={event.name} rows={products} onRowsChange={setProducts} />
            <VideoSection eventId={eventId} />
          </div>
        )}
        {tab === '행사 정보' && (
          <EventInfoSheet eventId={eventId} canEdit={roleResolved ? myRole === 'pm' || myRole === 'am' : event.pm === CURRENT_USER.name || event.am === CURRENT_USER.name} />
        )}
        {tab === '인력' && isMember && (
          <div className="mt-[16px] flex w-full flex-col gap-[12px]">
            <div className="flex justify-end">
              <PmTransfer eventId={eventId} meId={meId} isPm={roleResolved && myRole === 'pm'} onTransferred={() => { void queryClient.invalidateQueries({ queryKey: getEventsGetQueryKey(eventId) }); }} />
            </div>
            <EventMembers event={event} eventId={eventId} />
          </div>
        )}
      </div>

      <TaskBoard eventId={eventId} schedules={schedule} products={products} />

      <div className="flex items-stretch gap-[20px] px-[5px] max-lg:flex-col">
        <div
          className="relative flex h-[230px] w-[369px] shrink-0 items-end overflow-hidden rounded-[27px] border-[10px] border-solid border-brand-pink bg-brand-gradient p-[24px] shadow-card max-lg:w-full"
          aria-label={`${event.name} ${event.dday}`}
        >
          {/* D-day는 배경 장식으로 우상단에 두고, 행사명은 카드 안에서 줄바꿈·말줄임해 밖으로 넘치지 않게 한다. */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-[16px] top-[4px] z-[1] whitespace-nowrap text-[112px] font-bold leading-[0.9] tracking-[-0.9px] text-fg-inverse/60"
          >
            {event.dday}
          </span>
          <span
            title={event.name}
            className="relative z-[2] line-clamp-2 min-w-0 break-keep text-[44px] font-bold leading-[1.1] tracking-[-0.8px] text-fg-inverse [overflow-wrap:anywhere]"
          >
            {event.name}
          </span>
        </div>

        <section className={`flex min-w-0 flex-1 flex-col gap-[24px] p-[24px] ${CARD} rounded-lg`}>
          <h2 className="m-0 text-xl font-semibold text-black">할 일</h2>
          <div className="flex flex-col gap-[8px]">
            {openTodos.map((todo) => (
              <label key={todo.id} className="flex h-[37px] cursor-pointer items-center gap-[8px] rounded-md bg-surface-muted px-[11px]">
                <Checkbox
                  className="size-[17px]!"
                  checked={false}
                  onChange={() => completeTodo(todo)}
                />
                <span className="text-sm font-semibold text-fg">{todo.title}</span>
                <span className="flex-1" />
                {todo.due ? <span className="text-[10.5px] text-fg-muted">~{todo.due.slice(5).replace('-', '/')}</span> : null}
              </label>
            ))}
            {!openTodos.length && (
              <p className="m-0 px-[4px] py-[8px] text-sm text-fg-tertiary">
                {eventItems.isPending && eventItems.fetchStatus !== 'idle' ? '할 일을 불러오는 중입니다.' : '남은 할 일이 없습니다.'}
              </p>
            )}
          </div>
        </section>
      </div>

      {scheduleCalendar}

      {calDialog && <CalEventDialog defaultDate={dateOf(anchor)} onClose={() => setCalDialog(false)} onSubmit={addCalEvent} />}

      {inviteOpen && (
        <InviteDialog
          eventName={event.name}
          excludeIds={[...(members.data ?? []).map((m) => m.userId), ...(meId ? [meId] : [])]}
          onClose={() => setInviteOpen(false)}
          onInvite={(people, role) => {
            setInvited((v) => [...v, ...people.filter((p) => !v.some((x) => x.id === p.id)).map((p) => ({ ...p, as: role }))]);
            inviteMembers(people, role);
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
          members={assignable}
          storageKey={`event:${eventId}:${peekEvent.id}`}
          store={peekStore}
          onClose={() => setPeekId(null)}
        />
      )}
    </div>
  );
}

const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
