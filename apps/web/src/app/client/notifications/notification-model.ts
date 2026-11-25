import type { PortalNotificationDto } from '@miceplans/contracts/portal';
import { formatPeriod, todayIso } from '../portal';

/** Client 알림함 문구·시각·묶음 도출. 화면과 무관한 순수 함수만 둔다. */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const weekday = (iso: string): string => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]!;

/** 날짜 칩: 03.12 (수) */
const dayLabel = (iso: string): string => `${formatPeriod(iso, iso)} (${weekday(iso)})`;

/** 숫자 끝소리에 맞는 조사. 10·20·30과 3·6으로 끝나면 '으로', 나머지는 '로'. 숫자가 아니면 '으로'(예: 미정). */
export const euro = (text: string): string => (/[1245789]$/.test(text) ? '로' : '으로');

export type ScheduleChange = {
  label: '마감' | '시작일' | '일정';
  /** 문장에 쓰는 짧은 표기. 날짜가 없으면 null. */
  before: string | null;
  after: string | null;
  /** 상세 카드 칩 표기. */
  beforeChip: string;
  afterChip: string;
  verb: '앞당겨졌어요' | '미뤄졌어요' | '바뀌었어요';
};

/** 일정 변경 알림에서 바뀐 항목을 하나로 요약한다. 시작일과 마감이 함께 바뀌면 '일정'으로 묶는다. */
export function scheduleChange(n: PortalNotificationDto): ScheduleChange {
  const startChanged = n.beforeStartsOn !== n.afterStartsOn;
  const dueChanged = n.beforeDueOn !== n.afterDueOn;
  const range = (start: string | null, due: string | null): [string, string] | null => {
    const from = start ?? due;
    return from ? [from, due ?? from] : null;
  };
  const single = (iso: string | null): [string, string] | null => (iso ? [iso, iso] : null);
  const both = startChanged && dueChanged;
  const before = both ? range(n.beforeStartsOn, n.beforeDueOn) : single(dueChanged ? n.beforeDueOn : n.beforeStartsOn);
  const after = both ? range(n.afterStartsOn, n.afterDueOn) : single(dueChanged ? n.afterDueOn : n.afterStartsOn);
  const text = (r: [string, string] | null) => (r ? formatPeriod(r[0], r[1]) : null);
  const chip = (r: [string, string] | null) => (!r ? '미정' : r[0] === r[1] ? dayLabel(r[0]) : formatPeriod(r[0], r[1]));
  let verb: ScheduleChange['verb'] = '바뀌었어요';
  if (before && after) {
    if (after[0] <= before[0] && after[1] <= before[1]) verb = '앞당겨졌어요';
    else if (after[0] >= before[0] && after[1] >= before[1]) verb = '미뤄졌어요';
  }
  return { label: both ? '일정' : dueChanged ? '마감' : '시작일', before: text(before), after: text(after), beforeChip: chip(before), afterChip: chip(after), verb };
}

export function notificationTitle(n: PortalNotificationDto): string {
  const name = `“${n.programTitle}”`;
  if (n.kind === 'program_published') return `${name} 일정이 공유됐어요`;
  const c = scheduleChange(n);
  if (!c.after) return `${name} ${c.label}이 미정으로 바뀌었어요`;
  if (!c.before) return `${name} ${c.label}이 ${c.after}${euro(c.after)} 정해졌어요`;
  return `${name} ${c.label}이 ${c.before}에서 ${c.after}${euro(c.after)} ${c.verb}`;
}

export const notificationBody = (n: PortalNotificationDto): string =>
  n.kind === 'program_published'
    ? `${n.eventName}의 일정이 새로 공유됐어요. 대시보드와 행사 상세에서 볼 수 있어요.`
    : `${n.eventName}의 일정이 변경됐어요. 변경된 일정은 대시보드와 행사 상세에 바로 반영되어 있어요.`;

export const KIND_LABEL: Record<PortalNotificationDto['kind'], string> = { program_published: '일정 공유', schedule_changed: '일정 변경' };

const clock = (at: Date): string => {
  const h = at.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(at.getMinutes()).padStart(2, '0')}`;
};

const daysAgo = (at: Date, now: Date): number => {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(at)) / 86_400_000);
};

/** 목록 시각: 10분 전 · 3시간 전 · 오전 11:20 · 어제 오후 4:12 · 3월 5일 */
export function listTime(createdAt: string, now: Date): string {
  const at = new Date(createdAt);
  const ago = daysAgo(at, now);
  if (ago <= 0) {
    const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (minutes < 240) return `${Math.floor(minutes / 60)}시간 전`;
    return clock(at);
  }
  if (ago === 1) return `어제 ${clock(at)}`;
  return `${at.getMonth() + 1}월 ${at.getDate()}일`;
}

/** 상세 시각: 오늘 오후 1:24 · 어제 오전 9:00 · 3월 5일 오후 1:24 */
export function detailTime(createdAt: string, now: Date): string {
  const at = new Date(createdAt);
  const ago = daysAgo(at, now);
  const day = ago <= 0 ? '오늘' : ago === 1 ? '어제' : `${at.getMonth() + 1}월 ${at.getDate()}일`;
  return `${day} ${clock(at)}`;
}

export type NotificationGroup = { label: string; items: PortalNotificationDto[] };

/** 오늘·어제·이번 주·지난주·이전으로 묶는다. 한 주는 월요일에 시작하며 빈 묶음은 뺀다. */
export function groupNotifications(list: PortalNotificationDto[], now: Date): NotificationGroup[] {
  const sinceMonday = (now.getDay() + 6) % 7;
  const label = (n: PortalNotificationDto): string => {
    const ago = daysAgo(new Date(n.createdAt), now);
    if (ago <= 0) return '오늘';
    if (ago === 1) return '어제';
    if (ago <= sinceMonday) return '이번 주';
    if (ago <= sinceMonday + 7) return '지난주';
    return '이전';
  };
  const groups = new Map<string, PortalNotificationDto[]>();
  for (const n of list) {
    const key = label(n);
    const items = groups.get(key);
    if (items) items.push(n);
    else groups.set(key, [n]);
  }
  return [...groups].map(([l, items]) => ({ label: l, items }));
}

/** 연계 캘린더가 처음 보일 달. 알림이 가리키는 날짜의 달이고 날짜가 없으면 이번 달이다. */
export function notificationMonth(n: PortalNotificationDto, now = new Date()): { year: number; month: number } {
  const iso = n.afterStartsOn ?? n.afterDueOn ?? n.beforeStartsOn ?? n.beforeDueOn ?? todayIso(now);
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}
