/** docs/functional-specification.md 2.2 권한 매트릭스의 역할. */
export const ROLES = ['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLES as readonly string[]).includes(value);

/** Client 계정을 고객사에 연결·해제하는 것은 Client가 보는 행사 범위를 바꾸므로 Super Admin만 한다 (명세 F-07). */
export const canLinkClientAccount = (role: Role): boolean => role === 'super_admin';
