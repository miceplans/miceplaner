'use client';

import { useEffect, useState } from 'react';

import { Button, Checkbox, Dialog, Input, Select } from '@miceplans/ui';

export const ROLES = ['AM', '스태프'] as const;
export type InviteRole = (typeof ROLES)[number];
export type Invitee = { id: string; name: string; role: string };

/** PM이 행사에 초대할 수 있는 내부 사용자 후보. */
export const INVITEES: Invitee[] = [
  { id: 'SJ', name: '서준', role: 'Member' },
  { id: 'MK', name: '민기', role: 'Member' },
  { id: 'TR', name: '태리', role: 'Member' },
  { id: 'AL', name: '아린', role: 'Member' },
  { id: 'DN', name: '다은', role: 'Member' },
  { id: 'JP', name: '재필', role: 'Member' },
];

export function InviteDialog({
  eventName,
  onClose,
  onInvite,
}: {
  eventName: string;
  onClose: () => void;
  onInvite: (people: Invitee[], role: InviteRole) => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [role, setRole] = useState<InviteRole>('스태프');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const list = INVITEES.filter((p) => !q || p.name.toLowerCase().includes(q));
  const toggle = (id: string) => setPicked((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <Dialog onClose={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="멤버 초대"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!picked.length) return;
          onInvite(INVITEES.filter((p) => picked.includes(p.id)), role);
        }}
        className="flex w-[440px] max-w-full flex-col gap-[14px] rounded-lg bg-surface p-[20px] shadow-card"
      >
        <div className="flex flex-col gap-[2px]">
          <h2 className="m-0 text-lg font-semibold text-fg">멤버 초대</h2>
          <p className="m-0 text-sm text-fg-tertiary">{eventName}</p>
        </div>

        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 검색"
          aria-label="이름 검색"
          className="w-full"
        />

        <ul className="m-0 flex max-h-[240px] list-none flex-col gap-[2px] overflow-auto p-0">
          {list.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id}>
                <label className={`flex h-[40px] cursor-pointer items-center gap-[10px] rounded-md px-[8px] hover:bg-surface-subtle ${on ? 'bg-surface-muted' : ''}`}>
                  <Checkbox checked={on} onChange={() => toggle(p.id)} />
                  <span className="text-base text-fg">{p.name}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-fg-tertiary">{p.role}</span>
                </label>
              </li>
            );
          })}
          {!list.length && <li className="px-[8px] py-[12px] text-sm text-fg-tertiary">검색 결과가 없어요</li>}
        </ul>

        <label className="flex flex-col gap-[4px] text-sm text-fg-secondary">
          역할
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            className="w-full"
          >
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </label>

        <div className="flex justify-end gap-[8px]">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={!picked.length}>
            {picked.length ? `${picked.length}명 초대` : '초대'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
