'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Input, Select } from '@miceplans/ui';
import type { CreateEventBody } from '@miceplans/contracts';
import { ApiError, createEvent, listClients } from '../../../lib/api';

type Client = { id: string; name: string };

export function NewEventForm() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEventBody>({ clientId: '', name: '', startDate: '', endDate: '', place: '', status: '진행중', priority: false, color: null });

  useEffect(() => {
    void listClients()
      .then((items) => {
        setClients(items);
        setForm((current) => ({ ...current, clientId: current.clientId || items[0]?.id || '' }));
      })
      .catch((error: unknown) => setFailure(error instanceof Error ? error.message : '고객사 목록을 불러오지 못했다'))
      .finally(() => setLoadingClients(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    if (form.endDate < form.startDate) {
      setFailure('종료일은 시작일 이후여야 한다');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createEvent(form);
      window.location.assign(`/events/detail?id=${created.id}`);
    } catch (error) {
      setFailure(error instanceof ApiError || error instanceof Error ? error.message : '행사를 만들지 못했다');
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[760px] px-5 py-10">
      <a href="/" className="text-sm text-fg-secondary no-underline hover:text-fg">← 전체 행사</a>
      <h1 className="mt-4 text-2xl font-bold text-fg">새 행사</h1>
      <p className="mt-2 text-sm text-fg-secondary">생성한 사용자는 자동으로 이 행사의 PM이 됩니다.</p>
      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-lg border border-border bg-surface p-6">
        <label className="grid gap-2 text-sm font-medium text-fg">
          고객사
          <Select required value={form.clientId} disabled={loadingClients || clients.length === 0} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            {clients.length === 0 ? <option value="">{loadingClients ? '고객사 목록을 불러오는 중' : '등록된 고객사가 없습니다'}</option> : clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-fg">
          행사명
          <Input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-fg">
            시작일
            <Input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-fg">
            종료일
            <Input required type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium text-fg">
          장소
          <Input maxLength={200} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
        </label>
        {failure ? <p role="alert" className="text-sm text-red-600">{failure}</p> : null}
        <div className="mt-2 flex justify-end gap-2">
          <a href="/" className="rounded-md px-4 py-2 text-sm text-fg-secondary no-underline hover:bg-surface-sunken">취소</a>
          <button type="submit" disabled={submitting || loadingClients || clients.length === 0} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-fg-inverse disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? '생성 중…' : '행사 추가'}
          </button>
        </div>
      </form>
    </main>
  );
}
