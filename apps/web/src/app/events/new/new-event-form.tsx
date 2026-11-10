'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Select, toast } from '@miceplans/ui';
import { useDirectoryClients, useDirectoryUsers, useEventsCreate } from '../../../lib/api/generated/endpoints';
import { ApiError } from '../../../lib/api';

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col items-start gap-[6px]">
      <span className="text-sm font-semibold text-fg">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
    </label>
  );
}

/** 입력 중에도 천 단위 쉼표를 붙여 보여 준다. 숫자 외 문자는 버린다. */
const formatWon = (digits: string) => (digits === '' ? '' : Number(digits).toLocaleString('ko-KR'));

export function NewEventForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clients = useDirectoryClients();
  const users = useDirectoryUsers();
  const create = useEventsCreate();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [pmId, setPmId] = useState('');
  const [amId, setAmId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [place, setPlace] = useState('');
  const [budget, setBudget] = useState('');
  const [tried, setTried] = useState(false);

  const dateError = startDate !== '' && endDate !== '' && endDate < startDate;
  const amError = amId !== '' && amId === pmId;
  const missing = { name: name.trim() === '', clientId: clientId === '', pmId: pmId === '', startDate: startDate === '', endDate: endDate === '' };
  const invalid = Object.values(missing).some(Boolean) || dateError || amError;

  const loading = clients.isPending || users.isPending;
  const loadFailed = clients.isError || users.isError;
  const userOptions = (users.data ?? []).map((u) => ({ value: u.id, label: u.jobTitle ? `${u.name} · ${u.jobTitle}` : u.name }));

  const submit = async () => {
    setTried(true);
    if (invalid) return;
    try {
      const event = await create.mutateAsync({
        data: { name: name.trim(), clientId, pmId, amId: amId || null, startDate, endDate, place: place.trim(), status: '진행중', priority: false, color: null, budget: budget === '' ? null : Number(budget) },
      });
      void queryClient.invalidateQueries();
      toast.info('행사를 추가했습니다.');
      router.push(`/events/${event.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 행사를 추가하지 못했습니다.');
    }
  };

  if (loadFailed) {
    return (
      <div className="flex w-full flex-col items-start gap-[16px] rounded-lg bg-surface p-[24px] shadow-card">
        <p className="m-0 text-base text-fg">고객사·직원 목록을 불러오지 못했습니다.</p>
        <Button variant="secondary" href="/">행사 목록으로</Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex w-full min-w-0 flex-col items-start gap-[32px]"
    >
      <div className="grid w-full grid-cols-2 gap-[20px] rounded-lg bg-surface p-[24px] shadow-card max-md:grid-cols-1 max-md:p-[16px]">
        <div className="col-span-2 max-md:col-span-1">
          <Field label="행사명" required>
            <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} invalid={tried && missing.name} placeholder="행사명" className="w-full" />
          </Field>
        </div>
        <Field label="고객사" required>
          <Select
            value={clientId}
            disabled={loading}
            onChange={(e) => setClientId(e.target.value)}
            invalid={tried && missing.clientId}
            options={[{ value: '', label: loading ? '불러오는 중…' : '고객사 선택' }, ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            className="w-full"
          />
        </Field>
        <Field label="예산 (원)">
          <Input
            inputMode="numeric"
            value={formatWon(budget)}
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, '').slice(0, 15))}
            placeholder="미정"
            className="w-full text-right"
          />
        </Field>
        <Field label="PM" required>
          <Select
            value={pmId}
            disabled={loading}
            onChange={(e) => setPmId(e.target.value)}
            invalid={tried && missing.pmId}
            options={[{ value: '', label: loading ? '불러오는 중…' : 'PM 선택' }, ...userOptions]}
            className="w-full"
          />
        </Field>
        <Field label="AM">
          <Select
            value={amId}
            disabled={loading}
            onChange={(e) => setAmId(e.target.value)}
            invalid={tried && amError}
            options={[{ value: '', label: '선택 안 함' }, ...userOptions]}
            className="w-full"
          />
        </Field>
        <Field label="시작일" required>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} invalid={tried && missing.startDate} className="w-full" />
        </Field>
        <Field label="종료일" required>
          <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} invalid={tried && (missing.endDate || dateError)} className="w-full" />
        </Field>
        <div className="col-span-2 max-md:col-span-1">
          <Field label="장소">
            <Input value={place} maxLength={200} onChange={(e) => setPlace(e.target.value)} placeholder="장소" className="w-full" />
          </Field>
        </div>
        {tried && (dateError || amError) && (
          <p role="alert" className="col-span-2 m-0 text-xs text-error max-md:col-span-1">
            {dateError ? '종료일은 시작일 이후여야 합니다.' : 'PM과 AM은 다른 사람이어야 합니다.'}
          </p>
        )}
      </div>
      <div className="flex w-full items-center gap-[8px]">
        <Button variant="secondary" href="/">취소</Button>
        <a href="/import/upload" className="ml-[4px] text-sm text-fg-secondary">Excel로 가져오기</a>
        <div className="h-px min-w-px flex-1" />
        <Button variant="primary" type="submit" disabled={create.isPending || loading}>
          {create.isPending ? '추가 중…' : '행사 추가'}
        </Button>
      </div>
    </form>
  );
}
