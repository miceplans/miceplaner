'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { eventStatus, type EventListItemDto } from '@miceplans/contracts';
import { StatusPill, toast, type StatusKey } from '@miceplans/ui';
import { ApiError } from '../../../lib/api';
import { getEventsGetQueryKey, getEventsListQueryKey, useEventsUpdate } from '../../../lib/api/generated/endpoints';

/**
 * 행사 상태 선택창. PM·AM(과 Super Admin)만 바꿀 수 있고 서버·DB 트리거도 같은 기준으로 검사한다.
 * 상태는 일반 필드라 마지막 저장 우선이다 (명세 3.2).
 */
export function StatusSelect({ eventId, status, canChange }: { eventId: string; status: StatusKey; canChange: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const update = useEventsUpdate();

  if (!canChange) return <StatusPill status={status} />;

  const choose = (next: StatusKey) => {
    setOpen(false);
    if (next === status) return;
    update.mutate(
      { id: eventId, data: { status: next } },
      {
        onSuccess: (row) => {
          // 목록·상세 캐시를 바로 바꿔 깜빡임 없이 보여 주고, 조인 필드는 다시 불러온다.
          queryClient.setQueryData<EventListItemDto>(getEventsGetQueryKey(eventId), (prev) => (prev ? { ...prev, status: row.status, version: row.version } : prev));
          void queryClient.invalidateQueries({ queryKey: getEventsGetQueryKey(eventId) });
          void queryClient.invalidateQueries({ queryKey: getEventsListQueryKey() });
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : '[500] 행사 상태 변경에 실패했습니다.'),
      },
    );
  };

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="행사 상태 변경"
        disabled={update.isPending}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md px-[4px] py-[2px] hover:bg-surface-subtle disabled:opacity-50"
      >
        <StatusPill status={status} />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 top-full z-20 m-0 mt-[4px] flex min-w-[140px] list-none flex-col rounded-xl bg-surface p-[4px] shadow-card">
          {eventStatus.options.map((s) => (
            <li key={s} role="option" aria-selected={s === status}>
              <button type="button" onClick={() => choose(s)} className={`flex w-full rounded-md px-[8px] py-[4px] hover:bg-surface-subtle ${s === status ? 'bg-surface-subtle' : ''}`}>
                <StatusPill status={s} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
