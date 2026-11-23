'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, toast } from '@miceplans/ui';
import { ApiError, setToken } from '../../../lib/api';
import { useClientLogin } from '../../../lib/api/generated/endpoints';

export function ClientLoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const login = useClientLogin();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const session = await login.mutateAsync({ data: { email: email.trim(), password } });
      setToken(session.accessToken);
      window.location.assign('/client/dashboard');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 로그인에 실패했습니다.');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-sunken px-[16px]">
      <form onSubmit={submit} className="flex w-full max-w-[360px] flex-col gap-[16px] rounded-lg border border-solid border-border bg-surface p-[28px]">
        <div>
          <h1 className="m-0 text-xl font-semibold text-fg">Client 포털 로그인</h1>
          <p className="m-0 mt-[6px] text-sm text-fg-secondary">승인된 이메일과 비밀번호로 로그인하세요.</p>
        </div>
        <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">이메일<Input required type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">비밀번호<Input required type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <Button type="submit" disabled={busy} className="h-[40px] w-full">{busy ? '로그인 중…' : '로그인'}</Button>
        <a href="/client/apply" className="text-center text-sm text-fg-secondary">계정이 없나요? 신청하기</a>
      </form>
    </main>
  );
}
