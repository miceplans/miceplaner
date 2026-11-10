'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Input, Select, toast } from '@miceplans/ui';
import { useDirectoryClients, useDirectoryCreateClient, useDirectoryUsers, useEventsCreate } from '../../../lib/api/generated/endpoints';
import type { ClientDto } from '../../../lib/api/generated/model';
import { ApiError } from '../../../lib/api';

/** '+ 고객사'를 뜻하는 선택지 값. 실제 고객사 id와 겹치지 않는다. */
const NEW_CLIENT = '__new__';

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
  const createClient = useDirectoryCreateClient();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [pmId, setPmId] = useState('');
  const [amId, setAmId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [place, setPlace] = useState('');
  const [budget, setBudget] = useState('');
  const [tried, setTried] = useState(false);

  const dateError = startDate !== '' && endDate !== '' && endDate < startDate;
  const amError = amId !== '' && amId === pmId;
  const missing = { name: name.trim() === '', clientId: addingClient ? newClientName.trim() === '' : clientId === '', pmId: pmId === '', startDate: startDate === '', endDate: endDate === '' };
  const invalid = Object.values(missing).some(Boolean) || dateError || amError;

  const loading = clients.isPending || users.isPending;
  const loadFailed = clients.isError || users.isError;
  const userOptions = (users.data ?? []).map((u) => ({ value: u.id, label: u.jobTitle ? `${u.name} · ${u.jobTitle}` : u.name }));

  /** '+ 고객사' 입력을 Enter로 확정한다. 목록에 같은 이름이 있으면 재사용하고, 없으면 새로 만든 뒤 고른다. */
  const commitNewClient = async () => {
    const trimmed = newClientName.trim();
    if (trimmed === '') return;
    try {
      const existing = (clients.data ?? []).find((c) => c.name === trimmed);
      const created = existing ?? (await createClient.mutateAsync({ data: { name: trimmed } }));
      if (!existing) {
        queryClient.setQueryData<ClientDto[]>(['/clients'], (old) => (old ? [...old, created] : old));
        void queryClient.invalidateQueries({ queryKey: ['/clients'] });
      }
      setAddingClient(false);
      setNewClientName('');
      setClientId(created.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 고객사를 추가하지 못했습니다.');
    }
  };

  /** 제출까지 Enter를 안 친 경우를 대비해 고객사 id를 확정한다. */
  const resolveClientId = async () => {
    if (!addingClient) return clientId;
    const trimmed = newClientName.trim();
    if (trimmed === '') return clientId;
    const existing = (clients.data ?? []).find((c) => c.name === trimmed);
    if (existing) return existing.id;
    const created = await createClient.mutateAsync({ data: { name: trimmed } });
    void queryClient.invalidateQueries({ queryKey: ['/clients'] });
    return created.id;
  };

  const submit = async () => {
    setTried(true);
    if (invalid) return;
    try {
      const event = await create.mutateAsync({
        data: { name: name.trim(), clientId: await resolveClientId(), pmId, amId: amId || null, startDate, endDate, place: place.trim(), status: '진행중', priority: false, color: null, budget: budget === '' ? null : Number(budget) },
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
            value={addingClient ? NEW_CLIENT : clientId}
            disabled={loading}
            onChange={(e) => {
              const value = e.target.value;
              setAddingClient(value === NEW_CLIENT);
              if (value !== NEW_CLIENT) setClientId(value);
            }}
            invalid={tried && missing.clientId}
            options={[{ value: NEW_CLIENT, label: '+ 고객사' }, { value: '', label: loading ? '불러오는 중…' : '고객사 선택' }, ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            className="w-full"
          />
          {addingClient && (
            <Input
              value={newClientName}
              maxLength={200}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitNewClient();
                }
              }}
              disabled={createClient.isPending}
              invalid={tried && missing.clientId}
              placeholder="새 고객사명 (Enter로 등록)"
              className="w-full"
              autoFocus
            />
          )}
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
          <DatePicker value={startDate} onChange={setStartDate} invalid={tried && missing.startDate} className="w-full" />
        </Field>
        <Field label="종료일" required>
          <DatePicker value={endDate} min={startDate || undefined} onChange={setEndDate} invalid={tried && (missing.endDate || dateError)} className="w-full" />
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
        <Button variant="primary" type="submit" disabled={create.isPending || createClient.isPending || loading}>
          {create.isPending || createClient.isPending ? '추가 중…' : '행사 추가'}
        </Button>
      </div>
    </form>
  );
}
