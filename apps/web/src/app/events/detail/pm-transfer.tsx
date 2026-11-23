'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, toast } from '@miceplans/ui';
import { getEventsMembersQueryKey, useDirectoryUsers, useEventsMembers, useEventsTransferPm } from '../../../lib/api/generated/endpoints';

type Candidate = { userId: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = { pm: 'PM', am: 'AM', member: '멤버' };

/**
 * PM 넘기기. 부모(EventDetailView)가 실제 멤버 목록으로 본인의 PM 여부를 판정해 isPm으로
 * 넘겨 준다. 완료하면 멤버 캐시를 무효화하고 onTransferred로 상위 데이터를 다시 불러오게 한다.
 */
export function PmTransfer({ eventId, meId, isPm, onTransferred }: { eventId: string; meId: string | null; isPm: boolean; onTransferred: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const members = useEventsMembers(eventId, { query: { enabled: isPm } });
  // 사용자 명단은 세션 중 거의 바뀌지 않아 캐시를 고정 쓴다. PM 넘긴 뒤 멤버 갱신은 멤버 쿼리 무효화가 담당한다.
  const users = useDirectoryUsers({ query: { enabled: isPm, staleTime: Infinity } });
  // 멤버 목록을 불러오지 못하면(예: 목업 행사) data가 비어 후보를 비워 둔다.
  const candidates = useMemo<Candidate[]>(() => {
    if (!members.data || !users.data) return [];
    const nameOf = new Map(users.data.map((u) => [u.id, u.name]));
    return members.data
      .filter((m) => m.userId !== meId)
      .map((m) => ({ userId: m.userId, role: m.role, name: nameOf.get(m.userId) ?? m.userId }));
  }, [members.data, users.data, meId]);
  const transfer = useEventsTransferPm({
    mutation: {
      onSuccess: async () => {
        setOpen(false);
        setTarget(null);
        await queryClient.invalidateQueries({ queryKey: getEventsMembersQueryKey(eventId) });
        onTransferred();
        toast.info('PM을 넘겼습니다');
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'PM을 넘기지 못했다');
      },
    },
  });

  if (!isPm) return null;

  const submit = () => {
    if (!target) return;
    transfer.mutate({ id: eventId, data: { userId: target } });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-[32px] rounded-sm border border-solid border-border px-[14px] text-base font-medium text-fg-secondary hover:bg-surface-subtle"
      >
        PM 넘기기
      </button>
      {open && (
        <Dialog onClose={() => setOpen(false)}>
          <div role="dialog" aria-label="PM 넘기기" onClick={(e) => e.stopPropagation()} className="flex w-[380px] max-w-full flex-col gap-[16px] rounded-xl border border-solid border-border bg-surface p-[20px] shadow-card">
            <div className="flex flex-col gap-[6px]">
              <h2 className="m-0 text-lg font-semibold text-fg">PM 넘기기</h2>
              <p className="m-0 text-sm text-fg-secondary">새 PM을 선택하면 본인은 일반 멤버가 됩니다.</p>
            </div>
            <ul className="m-0 flex max-h-[240px] list-none flex-col gap-[2px] overflow-auto p-0">
              {candidates.map((candidate) => (
                <li key={candidate.userId}>
                  <label className="flex cursor-pointer items-center gap-[8px] rounded-md px-[8px] py-[8px] hover:bg-surface-sunken">
                    <input
                      type="radio"
                      name="pm-transfer-target"
                      checked={target === candidate.userId}
                      onChange={() => setTarget(candidate.userId)}
                      className="size-[16px] accent-brand"
                    />
                    <span className="flex-1 text-base text-fg">{candidate.name}</span>
                    <span className="rounded-md bg-surface-chip px-[7px] py-[3px] text-2xs font-semibold text-fg-secondary">{ROLE_LABEL[candidate.role] ?? candidate.role}</span>
                  </label>
                </li>
              ))}
              {candidates.length === 0 && <li className="px-[8px] py-[12px] text-sm text-fg-tertiary">넘길 수 있는 다른 멤버가 없습니다.</li>}
            </ul>
            <div className="flex justify-end gap-[8px]">
              <button type="button" onClick={() => setOpen(false)} className="h-[34px] rounded-md px-[13px] text-sm font-medium text-fg-secondary hover:bg-surface-subtle">
                취소
              </button>
              <button
                type="button"
                disabled={!target || transfer.isPending}
                onClick={submit}
                className="h-[34px] rounded-md bg-brand px-[14px] text-sm font-semibold text-fg-inverse hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {transfer.isPending ? '처리 중…' : '넘기기'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
