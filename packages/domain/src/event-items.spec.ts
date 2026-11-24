import { describe, expect, it } from 'vitest';
import { canChangeEventPublicVisibility, canChangeEventStatus, canDeleteEvent, canEditEventItems, canManageMembers, canTransferPm } from './event-items';

describe('행사 권한 (명세 2.2)', () => {
  it('Program 이하 편집은 행사 멤버까지', () => {
    expect((['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const).map(canEditEventItems)).toEqual([true, true, true, true, false, false]);
  });
  it('멤버 관리는 PM·AM', () => {
    expect(canManageMembers('member')).toBe(false);
    expect(canManageMembers('am')).toBe(true);
  });
  it('공개 캘린더 노출 변경은 PM·AM·Super Admin만', () => {
    expect((['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const).map(canChangeEventPublicVisibility)).toEqual([true, true, true, false, false, false]);
  });
  it('행사 상태 변경은 PM·AM·Super Admin만', () => {
    expect((['super_admin', 'pm', 'am', 'member', 'staff', 'client'] as const).map(canChangeEventStatus)).toEqual([true, true, true, false, false, false]);
  });
  it('행사 삭제는 PM만', () => {
    expect(canDeleteEvent('pm')).toBe(true);
    expect(canDeleteEvent('am')).toBe(false);
  });
  it('PM 넘기기는 현재 PM과 Super Admin (명세 F-02: 생성자는 PM이 된다)', () => {
    expect(canTransferPm('pm')).toBe(true);
    expect(canTransferPm('super_admin')).toBe(true);
    expect(canTransferPm('am')).toBe(false);
    expect(canTransferPm('member')).toBe(false);
    expect(canTransferPm('staff')).toBe(false);
  });
});
