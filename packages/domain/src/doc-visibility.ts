import type { Role } from './roles';

/** 문서 열람 범위. 화면 표기: all=전체 공개, members=행사 멤버, managers=PM·AM만. */
export const DOC_VISIBILITIES = ['all', 'members', 'managers'] as const;
export type DocVisibility = (typeof DOC_VISIBILITIES)[number];

export const DEFAULT_DOC_VISIBILITY: DocVisibility = 'members';

const VIEWERS: Record<DocVisibility, readonly Role[]> = {
  all: ['super_admin', 'pm', 'am', 'member', 'staff'],
  members: ['super_admin', 'pm', 'am', 'member'],
  managers: ['super_admin', 'pm', 'am'],
};

/** Client는 어떤 범위에서도 문서를 볼 수 없다. */
export function canViewDoc(visibility: DocVisibility, role: Role): boolean {
  return VIEWERS[visibility].includes(role);
}

/** 열람 범위는 PM·AM과 Super Admin만 바꿀 수 있다. */
export function canChangeDocVisibility(role: Role): boolean {
  return role === 'super_admin' || role === 'pm' || role === 'am';
}
