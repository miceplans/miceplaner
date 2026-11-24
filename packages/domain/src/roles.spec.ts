import { describe, expect, it } from 'vitest';
import { ROLES, canLinkClientAccount } from './roles';

describe('Client 계정 연결 권한 (명세 F-07)', () => {
  it('Super Admin만 Client 계정을 고객사에 연결한다', () => {
    expect(ROLES.filter(canLinkClientAccount)).toEqual(['super_admin']);
  });
});
