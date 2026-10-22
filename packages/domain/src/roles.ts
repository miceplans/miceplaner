/** docs/functional-specification.md 2.2 권한 매트릭스의 역할. */
export const ROLES = ['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLES as readonly string[]).includes(value);
