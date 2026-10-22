'use client';

import { avatarPalette } from '@miceplans/ui';

// TODO: 인증·인사 연동 전까지 고정하는 목업 현재 사용자. e1·e3의 PM으로 명단에 자연스럽게 들어간다.
export const CURRENT_USER = { name: '박서연', role: 'PM' } as const;

export type MemberInfo = {
  name: string;
  role: string;
  phone: string;
  email: string;
  note?: string;
};

type EventLeads = { pm: string; am: string; design: string };

// TODO: 멤버 API 연동 전 목업 지원 인력(스태프) 명단. invite-dialog의 INVITEES와 같은 사람풀이다.
const STAFF_BY_EVENT: Record<string, MemberInfo[]> = {
  e1: [
    { name: '서준', role: '스태프', phone: '010-2345-6789', email: 'seojun@miceplans.kr', note: '등록 데스크' },
    { name: '민기', role: '스태프', phone: '010-8765-4321', email: 'mingi@miceplans.kr', note: '안내 피켓' },
    { name: '태리', role: '스태프', phone: '010-5678-1234', email: 'taeri@miceplans.kr', note: '의전 지원' },
  ],
  e3: [
    { name: '아린', role: '스태프', phone: '010-1111-2222', email: 'arin@miceplans.kr', note: '등록 데스크' },
    { name: '다은', role: '스태프', phone: '010-3333-4444', email: 'daeun@miceplans.kr', note: '세션 타이머' },
  ],
};

export function getEventStaff(eventId: string): MemberInfo[] {
  return STAFF_BY_EVENT[eventId] ?? [];
}

/** 현재 사용자가 이 행사의 담당 인력(PM·AM)이거나 지원 인력(스태프)인지 판정한다. */
export function isEventMember(event: { pm: string; am: string }, eventId: string, userName: string): boolean {
  return event.pm === userName || event.am === userName || getEventStaff(eventId).some((m) => m.name === userName);
}

function MemberRow({ member, index }: { member: MemberInfo; index: number }) {
  const me = member.name === CURRENT_USER.name;
  return (
    <li className="flex items-center gap-[12px] rounded-md px-[8px] py-[9px] hover:bg-surface-sunken">
      <span
        style={{ backgroundColor: avatarPalette[index % avatarPalette.length] }}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-2xs font-bold text-fg-inverse"
      >
        {member.name.slice(0, 1)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-[6px] text-base font-medium text-fg">
          {member.name}
          {me && <span className="rounded-sm bg-brand-tint px-[5px] py-px text-2xs font-semibold text-brand">나</span>}
        </span>
        <span className="truncate text-sm text-fg-secondary">
          {member.phone} · {member.email}
        </span>
      </div>
      <span className="shrink-0 rounded-md bg-surface-chip px-[7px] py-[3px] text-2xs font-semibold text-fg-secondary">{member.role}</span>
      {member.note && <span className="w-[110px] shrink-0 truncate text-right text-sm text-fg-tertiary">{member.note}</span>}
    </li>
  );
}

function MemberList({ members }: { members: MemberInfo[] }) {
  return (
    <ul className="m-0 flex w-full list-none flex-col gap-[2px] p-0">
      {members.map((m, i) => (
        <MemberRow key={m.name} member={m} index={i} />
      ))}
    </ul>
  );
}

/** 행사 담당 인력: PM·AM·Design 담당자의 연락처 목록. */
export function EventLeadMembers({ event }: { event: EventLeads }) {
  const leads: MemberInfo[] = [
    { name: event.pm, role: 'PM', phone: '010-4821-3390', email: 'pm@miceplans.kr', note: '행사 총괄' },
    { name: event.am, role: 'AM', phone: '010-9931-2745', email: 'am@miceplans.kr', note: '현장 운영' },
    { name: event.design, role: 'Design', phone: '010-5517-8023', email: 'design@miceplans.kr', note: '제작 총괄' },
  ];
  return (
    <div className="flex w-full flex-col gap-[6px] py-[12px]">
      <MemberList members={leads} />
    </div>
  );
}

/** 행사 지원 인력: 배정된 스태프 명단. */
export function EventStaffMembers({ eventId }: { eventId: string }) {
  const staff = getEventStaff(eventId);
  return (
    <div className="flex w-full flex-col gap-[6px] py-[12px]">
      {staff.length ? (
        <MemberList members={staff} />
      ) : (
        <p className="m-0 px-[8px] py-[12px] text-base text-fg-tertiary">
          배정된 지원 인력이 없습니다. 상단의 &lsquo;+ 멤버 초대&rsquo;로 스태프를 초대해 보세요.
        </p>
      )}
    </div>
  );
}
