'use client';

import { createPersistedStore } from '@miceplans/ui/persisted-store';
import { ALL, type SortMode } from './task-board-model';

type Prefs = { event: string; sortMode: SortMode };

const DEFAULT_PREFS: Prefs = { event: ALL, sortMode: 'default' };

function decodePrefs(raw: unknown): Prefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const prefs = raw as { event?: unknown; sortMode?: unknown };
  return {
    event: typeof prefs.event === 'string' && prefs.event ? prefs.event : ALL,
    sortMode: prefs.sortMode === 'due-asc' || prefs.sortMode === 'due-desc' ? prefs.sortMode : 'default',
  };
}

/** 선택한 행사 필터와 정렬. 새로고침 후에도 유지한다. */
export const taskBoardPrefsStore = createPersistedStore<Prefs>({ key: 'miceplans.task-board.prefs', fallback: DEFAULT_PREFS, decode: decodePrefs });
