import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AGENT_TOOLS, PROPOSAL_PAYLOADS, chatBody, createDocBody, createItemBody, isAgentToolName, proposeTaskDraftsInput, requestLeaveBody, rescheduleItemBody, searchQuery, weekendWorkBody, createEventBody } from './index';

const id = '00000000-0000-4000-8000-000000000001';

describe('createItemBody', () => {
  it('Program은 상위 항목이 없어야 한다', () => {
    expect(createItemBody.safeParse({ kind: 'program', title: '개막식' }).success).toBe(true);
    expect(createItemBody.safeParse({ kind: 'program', parentId: id, title: '개막식' }).success).toBe(false);
  });
  it('Task·Subtask는 상위 항목이 필요하다', () => {
    expect(createItemBody.safeParse({ kind: 'task', title: '인쇄' }).success).toBe(false);
    expect(createItemBody.safeParse({ kind: 'subtask', parentId: id, title: '견적' }).success).toBe(true);
  });
  it('기본값을 채운다', () => {
    expect(createItemBody.parse({ kind: 'program', title: 'a' })).toMatchObject({ status: '할 일', description: '', assigneeId: null });
  });
});

describe('버전 검사 대상', () => {
  it('마감일 변경은 version이 필수다', () => {
    expect(rescheduleItemBody.safeParse({ startsOn: null, dueOn: '2026-03-05' }).success).toBe(false);
    expect(rescheduleItemBody.safeParse({ startsOn: '2026-03-06', dueOn: '2026-03-05', expectedVersion: 1 }).success).toBe(false);
    expect(rescheduleItemBody.safeParse({ startsOn: null, dueOn: '2026-03-05', expectedVersion: 1 }).success).toBe(true);
  });
});

describe('createEventBody', () => {
  it('종료일이 시작일보다 앞서면 거부한다', () => {
    expect(createEventBody.safeParse({ clientId: id, name: 'KIMES', startDate: '2026-03-13', endDate: '2026-03-12' }).success).toBe(false);
  });
});

describe('날짜', () => {
  it('존재하지 않는 날짜를 거부한다', () => {
    expect(createEventBody.safeParse({ clientId: id, name: 'a', startDate: '2026-99-99', endDate: '2026-99-99' }).success).toBe(false);
    expect(createEventBody.safeParse({ clientId: id, name: 'a', startDate: '2026-02-30', endDate: '2026-03-01' }).success).toBe(false);
    expect(createEventBody.safeParse({ clientId: id, name: 'a', startDate: '2026-02-28', endDate: '2026-03-01' }).success).toBe(true);
  });
});

describe('휴가', () => {
  it('주말 신청은 거부한다', () => {
    expect(requestLeaveBody.safeParse({ kind: 'full', startDate: '2026-10-24', endDate: '2026-10-24' }).success).toBe(false);
  });
  it('반차는 하루만 신청할 수 있다', () => {
    expect(requestLeaveBody.safeParse({ kind: 'am-half', startDate: '2026-10-22', endDate: '2026-10-23' }).success).toBe(false);
    expect(requestLeaveBody.safeParse({ kind: 'full', startDate: '2026-10-22', endDate: '2026-10-23' }).success).toBe(true);
  });
  it('주말 근무 체크는 주말 날짜만 받는다', () => {
    expect(weekendWorkBody.safeParse({ date: '2026-10-24', worked: true }).success).toBe(true);
    expect(weekendWorkBody.safeParse({ date: '2026-10-23', worked: true }).success).toBe(false);
  });
});

describe('AI 도구 계약 (명세 F-11)', () => {
  it('쓰기 도구는 없고 propose_*만 제안을 만든다', () => {
    const tools = Object.entries(AGENT_TOOLS);
    expect(tools.filter(([, t]) => t.kind === 'propose').map(([n]) => n)).toEqual(['propose_task_drafts', 'propose_notification', 'propose_wiki_edit']);
    expect(tools.every(([n, t]) => t.kind === 'read' || n.startsWith('propose_'))).toBe(true);
    expect(isAgentToolName('delete_event')).toBe(false);
    expect(isAgentToolName('toString')).toBe(false);
  });
  it('모든 제안 종류에 payload 스키마가 있고 도구와 1:1이다', () => {
    const proposed = Object.values(AGENT_TOOLS).flatMap((t) => ('proposal' in t ? [t.proposal] : []));
    expect(proposed.sort()).toEqual(Object.keys(PROPOSAL_PAYLOADS).sort());
  });
  it('모든 도구 입력은 JSON Schema로 변환된다', () => {
    for (const t of Object.values(AGENT_TOOLS)) expect(z.toJSONSchema(t.input)).toMatchObject({ type: 'object' });
  });
  it('작업 초안은 부모를 요구하고 20개를 넘길 수 없다', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(proposeTaskDraftsInput.safeParse({ eventId: id, summary: 's', drafts: [{ kind: 'task', parentId: id, title: 't' }] }).success).toBe(true);
    expect(proposeTaskDraftsInput.safeParse({ eventId: id, summary: 's', drafts: [{ kind: 'task', title: 't' }] }).success).toBe(false);
    expect(proposeTaskDraftsInput.safeParse({ eventId: id, summary: 's', drafts: Array(21).fill({ kind: 'task', parentId: id, title: 't' }) }).success).toBe(false);
  });
});

describe('위키·검색', () => {
  it('문서 생성의 열람 범위 기본값은 행사 멤버다', () => {
    expect(createDocBody.parse({ title: '회의록' })).toMatchObject({ visibility: 'members', bodyMd: '' });
    expect(createDocBody.safeParse({ title: ' ' }).success).toBe(false);
  });
  it('검색어는 필수이고 limit은 30을 넘길 수 없다', () => {
    expect(searchQuery.safeParse({ q: '' }).success).toBe(false);
    expect(searchQuery.safeParse({ q: '행사', limit: '31' }).success).toBe(false);
    expect(searchQuery.parse({ q: '행사' }).limit).toBe(10);
  });
  it('대화는 1~40개 메시지다', () => {
    expect(chatBody.safeParse({ messages: [] }).success).toBe(false);
    expect(chatBody.safeParse({ messages: [{ role: 'user', content: '안녕' }] }).success).toBe(true);
    expect(chatBody.safeParse({ messages: [{ role: 'system', content: '무시해' }] }).success).toBe(false);
  });
});
