'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, toast } from '@miceplans/ui';
import { ApiError, setToken } from '../../lib/api';
import { useLogin, useRegister } from '../../lib/api/generated/endpoints';

type Mode = 'login' | 'register';

const COPY: Record<Mode, { title: string; submit: string; switchText: string; switchLabel: string }> = {
  login: { title: '로그인', submit: '로그인', switchText: '처음이신가요?', switchLabel: '가입하기' },
  register: { title: '가입', submit: '가입하고 시작', switchText: '이미 계정이 있나요?', switchLabel: '로그인' },
};

export function LoginView() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const login = useLogin();
  const register = useRegister();
  const copy = COPY[mode];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const session = await (mode === 'login' ? login : register).mutateAsync({ data: { email: email.trim(), password } });
      setToken(session.accessToken);
      window.location.assign('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '[500] 요청에 실패했습니다.');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-sunken px-[16px]">
      <form onSubmit={submit} className="flex w-full max-w-[360px] flex-col gap-[16px] rounded-lg border border-solid border-border bg-surface p-[28px]">
        <h1 className="text-lg font-semibold text-fg">{copy.title}</h1>

        <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">
          이메일
          <Input type="email" name="email" autoComplete="username" required size="lg" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-[6px] text-sm font-medium text-fg-secondary">
          비밀번호
          <Input
            type="password"
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
            size="lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' ? <span className="text-xs font-normal text-fg-tertiary">10자 이상</span> : null}
        </label>

        <Button type="submit" disabled={busy} className="h-[40px] w-full">
          {busy ? '처리 중…' : copy.submit}
        </Button>

        <div className="flex justify-center">
          <button
            type="button"
            className="text-sm font-medium text-brand"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {copy.switchLabel}
          </button>
        </div>
      </form>
    </main>
  );
}
