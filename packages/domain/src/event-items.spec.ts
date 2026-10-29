import { describe, expect, it } from 'vitest';
import { canChangeEventSchedule, canDeleteEvent, canEditEventItems, canManageMembers, canTransferRole } from './event-items';

describe('행사 권한 (명세 2.2)', () => {
  it('Program 이하 편집은 행사 멤버까지', () => {
    expect((['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const).map(canEditEventItems)).toEqual([true, true, true, true, false, false]);
  });
  it('멤버 관리는 PM·AM', () => {
    expect(canManageMembers('member')).toBe(false);
    expect(canManageMembers('am')).toBe(true);
  });
  it('상태·기간 변경은 PM·AM, 역할 양도는 PM·AM 본인만', () => {
    expect((['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const).map(canChangeEventSchedule)).toEqual([true, true, true, false, false, false]);
    expect((['super_admin', 'pm', 'am', 'member'] as const).map(canTransferRole)).toEqual([false, true, true, false]);
  });
  it('행사 삭제는 PM만', () => {
    expect(canDeleteEvent('pm')).toBe(true);
    expect(canDeleteEvent('am')).toBe(false);
  });
});
