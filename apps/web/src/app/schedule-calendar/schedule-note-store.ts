'use client';

import { useMemo } from 'react';
import type { SidePeekContent, SidePeekStore } from '@miceplans/ui';
import { ApiError } from '../../lib/api';
import { scheduleNotesGet, scheduleNotesSave } from '../../lib/api/generated/endpoints';

/**
 * 캘린더 일정 상세 패널 내용을 서버(/schedule-notes)에 저장하는 저장소.
 * eventId가 있으면 행사에 묶인 메모로 저장되어 행사 멤버만 고칠 수 있다.
 */
export function useScheduleNoteStore(eventId: string | null = null): SidePeekStore {
  return useMemo<SidePeekStore>(
    () => ({
      async load(key) {
        const note = await scheduleNotesGet({ key });
        return { content: note.content as SidePeekContent, version: note.version };
      },
      async save(key, patch, baseVersion) {
        try {
          const note = await scheduleNotesSave({ key, eventId, baseVersion, patch });
          return { conflict: false, version: note.version };
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) return { conflict: true };
          throw error;
        }
      },
    }),
    [eventId],
  );
}
