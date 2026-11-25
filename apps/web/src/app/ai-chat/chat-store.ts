'use client';

import type { ChatEvent, ProposalDto } from '@miceplans/contracts';
import { createPersistedStore } from '@miceplans/ui/persisted-store';

export type Source = Extract<ChatEvent, { type: 'sources' }>['sources'][number];
export type Turn = { role: 'user' | 'assistant'; content: string; sources?: Source[]; proposals?: ProposalDto[]; error?: string };

/** 세션 저장값에서 유효한 대화만 골라낸다. */
function decodeTurns(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((turn): turn is Turn => {
    if (!turn || typeof turn !== 'object') return false;
    const candidate = turn as Turn;
    return (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string';
  });
}

/** 패널을 닫거나 화면을 이동해도 대화를 잃지 않도록 세션에 둔다. */
export const turnsStore = createPersistedStore<Turn[]>({ key: 'miceplans.ai-chat.turns', fallback: [], decode: decodeTurns, area: 'session' });

/** 스트리밍 중 아직 화면에 반영하지 않은 대화. */
let buffered: Turn[] | null = null;
let frame: number | null = null;

/** 반영 대기 중인 변경까지 포함한 대화. */
export const getTurns = (): Turn[] => buffered ?? turnsStore.get();

/** 즉시 반영이 필요한 변경(전송·승인 등). 프레임을 기다리지 않는다. */
export function commitTurns(next: Turn[]): void {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  buffered = null;
  turnsStore.set(next);
}

function flushTurns(): void {
  if (buffered) commitTurns(buffered);
}

/** 토큰마다 다시 그리지 않도록 프레임 단위로 묶어 한 차례의 대화를 고친다. */
export function patchTurn(index: number, fn: (turn: Turn) => Turn): void {
  buffered = getTurns().map((turn, i) => (i === index ? fn(turn) : turn));
  if (frame === null) frame = requestAnimationFrame(flushTurns);
}

// 탭 종료 때 프레임에 묶인 마지막 변경까지 저장한다.
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushTurns);
