'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@miceplans/ui';
import { ApiError } from '../../../lib/api';
import {
  getEventsGetQueryKey,
  getEventsListQueryKey,
  getEventsMembersQueryKey,
  useEventsAddMember,
  useEventsChangeMemberRole,
} from '../../../lib/api/generated/endpoints';
import type { EventMemberDto, UserDto } from '../../../lib/api/generated/model';

/** 행사 상세의 'AM'·'디자인' 속성에서 지정할 수 있는 담당 역할. */
export type LeadRole = 'am' | 'design';

const LEAD_LABEL: Record<LeadRole, string> = { am: 'AM', design: '디자인 담당' };

/**
 * 담당자 여러 명 선택창. 고르면 행사 멤버로 추가하거나(멤버가 아니면) 역할을 바꾸고,
 * 해제하면 일반 멤버로 돌린다. 멤버 추가·역할 변경은 서버가 PM·AM 권한을 검사하고 감사 로그를 남긴다.
 * PM은 PM 넘기기로만 바꾸므로 후보에서 고를 수 없다.
 */
export function LeadSelect({
  eventId,
  role,
  label,
  members,
  users,
  canManage,
}: {
  eventId: string;
  role: LeadRole;
  /** 현재 표시 이름(목록 응답의 amName·designName). 멤버 목록을 못 받았을 때 쓴다. */
  label: string;
  members: EventMemberDto[] | undefined;
  users: UserDto[] | undefined;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const addMember = useEventsAddMember();
  const changeRole = useEventsChangeMemberRole();
  const pending = addMember.isPending || changeRole.isPending;

  const roleOf = useMemo(() => new Map((members ?? []).map((m) => [m.userId, m.role])), [members]);
  const candidates = useMemo(() => (users ?? []).filter((u) => u.role !== 'client'), [users]);
  const selected = candidates.filter((u) => roleOf.get(u.id) === role);
  const text = members && users ? selected.map((u) => u.name).join(', ') : label;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getEventsMembersQueryKey(eventId) });
    void queryClient.invalidateQueries({ queryKey: getEventsGetQueryKey(eventId) });
    void queryClient.invalidateQueries({ queryKey: getEventsListQueryKey() });
  };
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : `[500] ${LEAD_LABEL[role]} 지정에 실패했습니다.`);

  const toggle = (user: UserDto) => {
    const current = roleOf.get(user.id);
    if (current === 'pm') return;
    const options = { onSuccess: refresh, onError: fail };
    if (current === undefined) addMember.mutate({ id: eventId, data: { userId: user.id, role } }, options);
    else changeRole.mutate({ id: eventId, userId: user.id, data: { role: current === role ? 'member' : role } }, options);
  };

  if (!canManage) return <>{text}</>;

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md px-[8px] py-[4px] text-base hover:bg-surface-subtle ${text ? 'text-fg' : 'text-fg-tertiary'}`}
      >
        {text || `${LEAD_LABEL[role]} 선택`}
      </button>
      {open && (
        <ul role="listbox" aria-multiselectable className="absolute left-0 top-full z-20 m-0 mt-[4px] flex max-h-[280px] min-w-[220px] list-none flex-col overflow-auto rounded-xl bg-surface p-[4px] shadow-card">
          {candidates.map((u) => {
            const current = roleOf.get(u.id);
            const checked = current === role;
            const isPm = current === 'pm';
            return (
              <li key={u.id} role="option" aria-selected={checked}>
                <button
                  type="button"
                  disabled={isPm || pending}
                  onClick={() => toggle(u)}
                  className="flex w-full items-center gap-[8px] rounded-md px-[10px] py-[6px] text-left text-base text-fg hover:bg-surface-subtle disabled:cursor-default disabled:opacity-50"
                >
                  <span aria-hidden className={`flex size-[16px] shrink-0 items-center justify-center rounded-sm border border-solid text-2xs ${checked ? 'border-brand bg-brand text-fg-inverse' : 'border-border-strong'}`}>
                    {checked ? '✓' : ''}
                  </span>
                  <span className="flex-1">{u.name}</span>
                  {isPm && <span className="text-xs text-fg-tertiary">PM</span>}
                  {current && current !== role && current !== 'pm' && current !== 'member' && (
                    <span className="text-xs text-fg-tertiary">{current === 'am' ? 'AM' : '디자인'}</span>
                  )}
                </button>
              </li>
            );
          })}
          {!candidates.length && <li className="px-[10px] py-[6px] text-base text-fg-tertiary">선택할 수 있는 직원이 없습니다.</li>}
        </ul>
      )}
    </div>
  );
}
