import type { Role } from './roles';

/** 명세 F-03: Event 아래 Program → Task → Subtask 한 계층. */
export const ITEM_KINDS = ['program', 'task', 'subtask'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** 상위 항목의 종류. Program은 상위가 없다. */
export const PARENT_KIND: Record<ItemKind, ItemKind | null> = { program: null, task: 'program', subtask: 'task' };

/** 할 일 보드 열과 같은 상태값 (초안: 명세 7절 확정 전). */
export const ITEM_STATUSES = ['할 일', '진행 중', '검토 대기', '보류', '취소', '완료'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const PRODUCT_PARTS = ['디자인', '영상', '3D'] as const;
export type ProductPart = (typeof PRODUCT_PARTS)[number];

/** 행사 목록 상태 배지와 같은 값. Figma '상태 태그' 순서를 따른다. */
export const EVENT_STATUSES = ['진행중', '성공', '확인중', '실패', '만료', '보류중', '제출', '반려', '종료'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const NOTIFICATION_KINDS = ['assigned', 'schedule_changed', 'due_soon', 'member_changed', 'pm_transferred', 'client_application'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const ITEM_EDITORS: readonly Role[] = ['super_admin', 'pm', 'am', 'member'];
const MEMBER_MANAGERS: readonly Role[] = ['super_admin', 'pm', 'am'];

/** Program 이하 항목과 행사 기본 정보 편집: 행사 멤버(PM·AM 포함)와 Super Admin. Staff는 조회만 한다. */
export const canEditEventItems = (role: Role): boolean => ITEM_EDITORS.includes(role);

/** 멤버 추가·삭제는 PM·AM과 Super Admin. */
export const canManageMembers = (role: Role): boolean => MEMBER_MANAGERS.includes(role);

/** 비로그인 공개 캘린더 노출(공개 상태) 변경은 PM·AM과 Super Admin (명세 F-07, 감사 로그 대상). */
export const canChangeEventPublicVisibility = (role: Role): boolean => MEMBER_MANAGERS.includes(role);

/** 행사 상태(진행중·성공 등) 변경은 PM·AM과 Super Admin (2026-11-24 결정). */
export const canChangeEventStatus = (role: Role): boolean => MEMBER_MANAGERS.includes(role);

/** 행사 삭제는 PM과 Super Admin. */
export const canDeleteEvent = (role: Role): boolean => role === 'super_admin' || role === 'pm';

/**
 * PM 넘기기는 현재 행사의 PM만 할 수 있다. Super Admin이 행사를 만들면 그 행사의 PM이
 * 되므로(명세 F-02) Super Admin도 자기 행사의 PM을 넘길 수 있다. 다른 사람의 행사에서
 * Super Admin이 직접 넘기는 것은 여전히 허용하지 않는다 — 넘기려면 먼저 그 행사의 PM이어야 한다.
 */
export const canTransferPm = (role: Role): boolean => role === 'pm' || role === 'super_admin';
