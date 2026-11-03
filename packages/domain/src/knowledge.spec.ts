import { describe, expect, it } from 'vitest';
import { canDecideProposal, canEditWiki, canQueryAi } from './knowledge';
import { ROLES } from './roles';

describe('위키·AI 권한 (명세 2.2)', () => {
  it('Client만 AI 질의를 할 수 없다', () => {
    expect(ROLES.filter((r) => !canQueryAi(r))).toEqual(['client']);
  });
  it('제안 승인과 위키 편집은 PM·AM·Super Admin만 한다', () => {
    const allowed = ROLES.filter(canDecideProposal);
    expect(allowed).toEqual(['super_admin', 'pm', 'am']);
    expect(ROLES.filter(canEditWiki)).toEqual(allowed);
  });
});
