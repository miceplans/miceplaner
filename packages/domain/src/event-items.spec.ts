import { describe, expect, it } from 'vitest';
import { canDeleteEvent, canEditEventItems, canManageMembers } from './event-items';

describe('행사 권한 (명세 2.2)', () => {
  it('Program 이하 편집은 행사 멤버까지', () => {
    expect((['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const).map(canEditEventItems)).toEqual([true, true, true, true, false, false]);
  });
  it('멤버 관리는 PM·AM', () => {
    expect(canManageMembers('member')).toBe(false);
    expect(canManageMembers('am')).toBe(true);
  });
  it('행사 삭제는 PM만', () => {
    expect(canDeleteEvent('pm')).toBe(true);
    expect(canDeleteEvent('am')).toBe(false);
  });
});
