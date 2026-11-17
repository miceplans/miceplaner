'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, toast } from '@miceplans/ui';
import { ApiError } from '../../../lib/api';
import http from '../../../lib/api/http';

/** client. 서브도메인에서 `/apply`로 매핑하는 공개 Client 포털 신청 화면. */
export default function ClientApplyPage() {
  const [companyName, setCompanyName] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await http('/auth/client-applications', { method: 'POST', body: JSON.stringify({ companyName, applicantName, email, password }) });
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-sunken px-[16px]">
      <form onSubmit={submit} className="flex w-full max-w-[420px] flex-col gap-[16px] rounded-lg border border-solid border-border bg-surface p-[28px]">
        <div>
          <h1 className="m-0 text-xl font-semibold text-fg">Client 포털 신청</h1>
          <p className="m-0 mt-[6px] text-sm text-fg-secondary">승인되면 등록한 이메일과 비밀번호로 포털을 이용할 수 있습니다.</p>
        </div>
        {submitted ? (
          <p className="rounded-sm bg-brand-tint p-[12px] text-sm text-brand">신청했습니다. 내부 관리자 승인 후 로그인할 수 있습니다.</p>
        ) : (
          <>
            <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">회사명<Input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
            <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">이름<Input required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} /></label>
            <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">이메일<Input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">비밀번호<Input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><span className="text-xs font-normal text-fg-tertiary">8자 이상</span></label>
            <Button type="submit" disabled={busy} className="h-[40px] w-full">{busy ? '신청 중…' : '신청하기'}</Button>
          </>
        )}
      </form>
    </main>
  );
}
