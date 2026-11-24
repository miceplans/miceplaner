import type { Role } from './roles';

/** 전체 공지 작성은 Super Admin만 한다 (명세 F-13, 2026-11-23 결정). */
export const canCreateGlobalNotice = (role: Role): boolean => role === 'super_admin';

/** 행사 공지 작성은 그 행사의 PM·AM과 Super Admin이 한다 (명세 F-13). */
export const canCreateEventNotice = (eventRole: Role): boolean =>
  eventRole === 'pm' || eventRole === 'am' || eventRole === 'super_admin';

/** 공지 삭제는 작성자와 Super Admin만 한다 (명세 F-13). */
export const canDeleteNotice = (role: Role, authorId: string, userId: string): boolean =>
  role === 'super_admin' || authorId === userId;
