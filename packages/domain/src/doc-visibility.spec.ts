import { describe, expect, it } from 'vitest';
import { canChangeDocVisibility, canViewDoc, DOC_VISIBILITIES } from './doc-visibility';
import { ROLES } from './roles';

describe('canViewDoc', () => {
  it('Client는 어떤 범위에서도 볼 수 없다', () => {
    for (const v of DOC_VISIBILITIES) expect(canViewDoc(v, 'client')).toBe(false);
  });
  it('PM·AM만 범위에서는 Staff와 행사 멤버가 볼 수 없다', () => {
    expect(canViewDoc('managers', 'staff')).toBe(false);
    expect(canViewDoc('managers', 'member')).toBe(false);
    expect(canViewDoc('managers', 'pm')).toBe(true);
    expect(canViewDoc('managers', 'am')).toBe(true);
  });
  it('행사 멤버 범위는 Staff를 제외한다', () => {
    expect(canViewDoc('members', 'member')).toBe(true);
    expect(canViewDoc('members', 'staff')).toBe(false);
  });
  it('전체 공개는 내부 직원 모두 볼 수 있다', () => {
    for (const r of ROLES.filter((r) => r !== 'client')) expect(canViewDoc('all', r)).toBe(true);
  });
});

describe('canChangeDocVisibility', () => {
  it('PM·AM·Super Admin만 바꿀 수 있다', () => {
    expect(ROLES.filter(canChangeDocVisibility)).toEqual(['super_admin', 'pm', 'am']);
  });
});
