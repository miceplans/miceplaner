'use client';

import { useMemo, useState } from 'react';
import { useGetMe, useStaffAccountsList, useStaffAccountsUpdate } from '../../lib/api/generated/endpoints';

type Filter = 'all' | 'active' | 'departed';

export function StaffManagementView() {
  const me = useGetMe();
  const list = useStaffAccountsList({ query: { enabled: me.data?.role === 'super_admin' } });
  const update = useStaffAccountsUpdate();
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data ?? []).filter((staff) => (filter === 'all' || staff.employmentStatus === filter)
      && (!q || [staff.name, staff.email, staff.jobTitle].some((value) => value.toLowerCase().includes(q))));
  }, [filter, list.data, query]);
  const activeCount = (list.data ?? []).filter((staff) => staff.employmentStatus === 'active').length;
  const adminCount = (list.data ?? []).filter((staff) => staff.employmentStatus === 'active' && staff.role === 'super_admin').length;

  const change = async (id: string, body: { role?: 'super_admin' | 'staff'; employmentStatus?: 'active' | 'departed' }) => {
    setMessage('');
    try {
      await update.mutateAsync({ id, data: body });
      await list.refetch();
      setMessage('변경사항을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '변경하지 못했습니다.');
    }
  };

  if (me.isPending) return <div className="p-[28px] text-base text-fg-secondary">권한을 확인하는 중…</div>;
  if (me.data?.role !== 'super_admin') return <div className="p-[28px]"><h1 className="text-2xl font-bold text-fg">직원 관리</h1><p className="text-base text-fg-secondary">대표 관리자만 접근할 수 있습니다.</p></div>;

  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="flex h-[56px] items-center border-b border-border bg-surface px-[20px]"><span className="text-base font-medium text-fg">직원 관리</span></header>
      <main className="flex flex-col gap-[20px] p-[28px] max-md:p-[16px]">
        <div>
          <h1 className="m-0 text-2xl font-bold text-fg">직원 가입·퇴사 관리</h1>
          <p className="m-0 mt-[6px] text-base text-fg-secondary">직원 계정의 재직 상태와 대표 관리자 권한을 관리합니다.</p>
        </div>
        <section className="grid grid-cols-2 gap-[12px] max-sm:grid-cols-1">
          <div className="rounded-lg border border-border bg-surface p-[18px]"><p className="m-0 text-sm text-fg-secondary">재직 직원</p><p className="m-0 mt-[6px] text-2xl font-bold text-fg">{activeCount}명</p></div>
          <div className="rounded-lg border border-border bg-surface p-[18px]"><p className="m-0 text-sm text-fg-secondary">대표 관리자</p><p className="m-0 mt-[6px] text-2xl font-bold text-fg">{adminCount}명</p></div>
        </section>
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-[10px] border-b border-border p-[14px]">
            <label className="min-w-[220px] flex-1"><span className="sr-only">직원 검색</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름, 이메일, 직급 검색" className="h-[36px] w-full rounded-sm border border-border bg-surface px-[12px] text-base text-fg outline-none focus:border-brand" /></label>
            <div className="flex rounded-sm bg-surface-chip p-[3px]">
              {([['active', '재직'], ['departed', '퇴사'], ['all', '전체']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-sm px-[12px] py-[6px] text-sm ${filter === value ? 'bg-surface font-semibold text-fg shadow-sm' : 'text-fg-secondary'}`}>{label}</button>)}
            </div>
          </div>
          {message ? <p role="status" className="m-0 border-b border-border bg-brand-tint px-[16px] py-[9px] text-sm text-fg">{message}</p> : null}
          <div className="mobile-table-scroll overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead><tr className="border-b border-border bg-surface-sunken text-xs text-fg-tertiary"><th className="px-[16px] py-[10px]">직원</th><th className="px-[16px] py-[10px]">직급</th><th className="px-[16px] py-[10px]">가입일</th><th className="px-[16px] py-[10px]">권한</th><th className="px-[16px] py-[10px]">상태</th><th className="px-[16px] py-[10px] text-right">관리</th></tr></thead>
              <tbody>
                {list.isPending ? <tr><td colSpan={6} className="px-[16px] py-[24px] text-center text-sm text-fg-tertiary">직원 목록을 불러오는 중…</td></tr> : null}
                {list.isError ? <tr><td colSpan={6} className="px-[16px] py-[24px] text-center text-sm text-error-delay">직원 목록을 불러오지 못했습니다.</td></tr> : null}
                {!list.isPending && !list.isError && rows.length === 0 ? <tr><td colSpan={6} className="px-[16px] py-[24px] text-center text-sm text-fg-tertiary">조건에 맞는 직원이 없습니다.</td></tr> : null}
                {rows.map((staff) => <tr key={staff.id} className="border-b border-border last:border-0">
                  <td className="px-[16px] py-[12px]"><div className="font-semibold text-fg">{staff.name}</div><div className="mt-[2px] text-xs text-fg-tertiary">{staff.email}</div></td>
                  <td className="px-[16px] py-[12px] text-sm text-fg-secondary">{staff.jobTitle || '-'}</td>
                  <td className="px-[16px] py-[12px] text-sm text-fg-secondary">{staff.joinedAt.slice(0, 10)}</td>
                  <td className="px-[16px] py-[12px]"><span className={`rounded-full px-[9px] py-[4px] text-xs font-semibold ${staff.role === 'super_admin' ? 'bg-brand-tint text-brand' : 'bg-surface-chip text-fg-secondary'}`}>{staff.role === 'super_admin' ? '대표 관리자' : '직원'}</span></td>
                  <td className="px-[16px] py-[12px]"><span className={`rounded-full px-[9px] py-[4px] text-xs font-semibold ${staff.employmentStatus === 'active' ? 'bg-success-bg text-success-deep' : 'bg-surface-chip text-fg-tertiary'}`}>{staff.employmentStatus === 'active' ? '재직' : '퇴사'}</span></td>
                  <td className="px-[16px] py-[12px] text-right"><div className="flex justify-end gap-[6px]">
                    <button type="button" disabled={update.isPending || staff.id === me.data?.id} onClick={() => change(staff.id, { role: staff.role === 'super_admin' ? 'staff' : 'super_admin' })} className="rounded-sm border border-border px-[9px] py-[6px] text-xs font-medium text-fg disabled:opacity-40">{staff.role === 'super_admin' ? '관리자 해제' : '관리자 승격'}</button>
                    <button type="button" disabled={update.isPending || staff.id === me.data?.id} onClick={() => change(staff.id, { employmentStatus: staff.employmentStatus === 'active' ? 'departed' : 'active' })} className={`rounded-sm px-[9px] py-[6px] text-xs font-medium disabled:opacity-40 ${staff.employmentStatus === 'active' ? 'bg-error-bg text-error-delay' : 'bg-brand text-fg-inverse'}`}>{staff.employmentStatus === 'active' ? '퇴사 처리' : '재직 복구'}</button>
                  </div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
