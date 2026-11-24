'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { dDayLabel } from '@miceplans/domain';
import { Checkbox, SegmentControl, StatusPill, TextTabs, Toggle, toast, type StatusKey } from '@miceplans/ui';
import { ItemAccessContext } from './event-checklist';
import { toggleItem, type CheckItem } from './event-checklist-model';
import type { Invitee, InviteRole } from './invite-dialog';
import type { Team } from './event-products-model';
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
import { ClientSelect } from './client-select';
import { EventCalendar } from './event-calendar';
import { useEventLists } from './use-event-lists';
import type { EventListItemDto } from '@miceplans/contracts';
import { setEventItems, setEventTab } from '../../ai-chat/event-context';

/** 상단 '할 일' 카드 항목. local은 이 기기에 저장된 스케줄 하위 할 일이다. */
type OpenTodo = { id: string; title: string; due?: string; local: boolean };

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
const DesignRequestTable = dynamic(() => import('./design-request-table').then((module) => module.DesignRequestTable));
const ProgressTable = dynamic(() => import('./progress-table').then((module) => module.ProgressTable));
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

const TABS_BY_TEAM = {
  planning: ['스케줄', '할 일', '문서', '통계', '제작물', '행사 정보', '인력'],
  design: ['스케줄', '할 일', '문서', '통계', '행사 정보', '인력'],
} as const;
type TabName = (typeof TABS_BY_TEAM)['planning'][number];
const MEMBER_TABS: TabName[] = ['인력'];
const DEFAULT_TAB: Record<Team, TabName> = { planning: '제작물', design: '스케줄' };
const PART_OPTIONS = PART_FILTERS.map((p) => ({ value: p, label: p }));

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
  const { schedule, setSchedule, products, setProducts, calEvents, setCalEvents } = useEventLists(eventId, assignable);
  // AI 에이전트가 화면의 스케줄·할 일(브라우저에만 저장)을 볼 수 있게 한다.
  useEffect(() => {
    setEventItems(schedule);
    return () => setEventItems(undefined);
  }, [schedule]);
  const access = useMemo(() => ({ me: CURRENT_USER.name, members: assignable }), [assignable]);
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

      <EventCalendar
        eventId={eventId}
        color={event.color}
        place={event.place}
        schedule={schedule}
        members={assignable}
        calEvents={calEvents}
        onCalEventsChange={setCalEvents}
      />

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
    </div>
  );
}
