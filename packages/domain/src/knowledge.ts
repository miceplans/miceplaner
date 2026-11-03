import type { Role } from './roles';

/** AI 제안 종류. 도구 `propose_*`와 1:1이다 (명세 F-11). */
export const PROPOSAL_KINDS = ['task_drafts', 'notification', 'wiki_edit'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** AI 질의는 내부 직원 전체가 할 수 있고 Client는 할 수 없다 (명세 2.2). */
export function canQueryAi(role: Role): boolean {
  return role !== 'client';
}

/** AI 제안 승인·반려는 PM·AM과 Super Admin만 한다 (명세 2.2). */
export function canDecideProposal(role: Role): boolean {
  return role === 'super_admin' || role === 'pm' || role === 'am';
}

/** 행사 위키 생성·수정·삭제는 PM·AM과 Super Admin만 한다 (명세 2.2). */
export function canEditWiki(role: Role): boolean {
  return canDecideProposal(role);
}
