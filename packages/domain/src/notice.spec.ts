import { describe, expect, it } from 'vitest';
import { canCreateEventNotice, canCreateGlobalNotice, canDeleteNotice } from './notice';

describe('공지 권한 (명세 F-13)', () => {
  it('전체 공지는 Super Admin만 올린다', () => {
    expect(canCreateGlobalNotice('super_admin')).toBe(true);
    expect(canCreateGlobalNotice('staff')).toBe(false);
    expect(canCreateGlobalNotice('pm')).toBe(false);
    expect(canCreateGlobalNotice('client')).toBe(false);
  });

  it('행사 공지는 그 행사의 PM·AM과 Super Admin이 올린다', () => {
    expect(canCreateEventNotice('pm')).toBe(true);
    expect(canCreateEventNotice('am')).toBe(true);
    expect(canCreateEventNotice('super_admin')).toBe(true);
    expect(canCreateEventNotice('member')).toBe(false);
    expect(canCreateEventNotice('staff')).toBe(false);
    expect(canCreateEventNotice('client')).toBe(false);
  });

  it('공지 삭제는 작성자와 Super Admin만 한다', () => {
    expect(canDeleteNotice('staff', 'u1', 'u1')).toBe(true);
    expect(canDeleteNotice('staff', 'u1', 'u2')).toBe(false);
    expect(canDeleteNotice('super_admin', 'u1', 'u2')).toBe(true);
  });
});
