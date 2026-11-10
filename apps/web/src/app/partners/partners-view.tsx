'use client';

import { useEffect, useMemo, useState } from 'react';
import { FlowTopbar, Input, PageFrame, Select, Textarea } from '@miceplans/ui';
import { PARTNER_FIELDS, PARTNER_FIELD_BADGE, PARTNERS, type Partner, type PartnerField } from '../../data/partners';

type Filter = string;

const FIELDS_KEY = 'miceplans.partners.fields';
const LIST_KEY = 'miceplans.partners.list';

type EditableKey = 'name' | 'field' | 'manager' | 'phone' | 'email' | 'memo';

const EMPTY: Omit<Partner, 'id' | 'events'> = { name: '', field: '', manager: '', phone: '', email: '', memo: '' };

/** localStorage에 저장된 값을 읽는다. 없거나 깨지면 fallback이다. */
function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function PartnersView() {
  const [fields, setFields] = useState<PartnerField[]>(PARTNER_FIELDS);
  const [partners, setPartners] = useState<Partner[]>(PARTNERS);
  const [form, setForm] = useState<(Omit<Partner, 'id' | 'events'> & { id?: string }) | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // 수정 중인 태그, '' 는 새 태그
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<Filter>('전체');

  useEffect(() => {
    setFields(load(FIELDS_KEY, PARTNER_FIELDS));
    setPartners(load(LIST_KEY, PARTNERS));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
      window.localStorage.setItem(LIST_KEY, JSON.stringify(partners));
    } catch {
      /* 저장 실패는 무시한다. */
    }
  }, [fields, partners, loaded]);

  const commit = () => {
    const name = draft.trim();
    const from = editing;
    setEditing(null);
    if (from === null || !name || name === from || name === '전체' || fields.includes(name)) return;
    if (from === '') {
      setFields([...fields, name]);
      return;
    }
    setFields(fields.map((f) => (f === from ? name : f)));
    setPartners(partners.map((p) => (p.field === from ? { ...p, field: name } : p)));
    if (filter === from) setFilter(name);
  };

  const remove = (f: string) => {
    if (partners.some((p) => p.field === f) && !window.confirm(`'${f}' 태그를 쓰는 협력사가 있습니다. 삭제할까요?`)) return;
    setFields(fields.filter((x) => x !== f));
    if (filter === f) setFilter('전체');
  };
  const save = () => {
    if (!form) return;
    const data = { ...form, name: form.name.trim(), field: form.field || fields[0] || '' };
    if (!data.name) return;
    if (data.id) {
      setPartners(partners.map((p) => (p.id === data.id ? { ...p, ...data, id: p.id } : p)));
    } else {
      setPartners([...partners, { ...data, id: `p${Date.now()}`, events: '' }]);
    }
    setForm(null);
  };
  const removePartner = () => {
    if (!form?.id || !window.confirm(`'${form.name}' 협력사를 삭제할까요?`)) return;
    setPartners(partners.filter((p) => p.id !== form.id));
    setForm(null);
  };
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const [cellEdit, setCellEdit] = useState<{ id: string; key: EditableKey; value: string } | null>(null);
  const [sort, setSort] = useState<'name' | 'field' | 'manager'>('name');

  const rows = useMemo(() => {
    const list = partners.filter((p) => (filter === '전체' ? true : p.field === filter)).filter((p) =>
      q ? [p.name, p.manager].some((v) => v.toLowerCase().includes(q)) : true,
    );
    return [...list].sort((a, b) => a[sort].localeCompare(b[sort], 'ko') || a.name.localeCompare(b.name, 'ko'));
  }, [partners, filter, q, sort]);

  return (
    <PageFrame topbar={<FlowTopbar title="외부 협력사" />}>
      <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] px-[24px] py-[20px]">
        <div className="flex w-full items-center gap-[12px]">
          <div className="flex items-center gap-[6px]" role="tablist" aria-label="분야별 필터">
            {['전체', ...fields].map((f) => {
              const on = filter === f;
              const count = f === '전체' ? partners.length : partners.filter((p) => p.field === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(f)}
                  className={`flex h-[30px] items-center gap-[6px] rounded-sm px-[11px] ${
                    on ? 'bg-brand text-fg-inverse' : 'bg-surface-chip text-fg-secondary hover:text-fg'
                  }`}
                >
                  <span className="whitespace-nowrap text-xs font-medium">{f}</span>
                  <span className={`whitespace-nowrap text-2xs ${on ? 'text-fg-inverse' : 'text-fg-tertiary'}`}>{count}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTagModal(true)}
              className="flex h-[30px] items-center rounded-sm bg-surface-chip px-[11px] text-xs text-fg-tertiary hover:text-fg"
            >
              태그 관리
            </button>
          </div>
          <div className="h-px min-w-px flex-1" />
          <Select
            aria-label="정렬"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'name' | 'field' | 'manager')}
            variant="chip"
            size="sm"
            className="shrink-0"
          >
            <option value="name">업체명순</option>
            <option value="field">분야순</option>
            <option value="manager">담당자순</option>
          </Select>
          <label className="flex h-[30px] w-[220px] items-center gap-[8px] rounded-sm bg-surface-chip px-[10px]">
            <svg viewBox="0 0 16 16" fill="none" className="size-[13px] shrink-0" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" className="text-fg-tertiary" strokeWidth="1.5" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" className="text-fg-tertiary" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              variant="ghost"
              className="flex-1 text-xs"
            />
          </label>
        </div>
        <div className="flex w-full items-center justify-between">
          <span className="whitespace-nowrap text-xs text-fg-tertiary">
            협력사 <span className="font-semibold text-fg">{rows.length}</span>개
            {q || filter !== '전체' ? ` (전체 ${partners.length}개)` : ''}
          </span>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY, field: filter === '전체' ? (fields[0] ?? '') : filter })}
            className="flex h-[30px] items-center rounded-sm bg-brand px-[12px] text-xs font-medium text-fg-inverse"
          >
            + 협력사 추가
          </button>
        </div>
        <div className="flex w-full flex-col items-start rounded-lg border border-solid border-border">
          <div className="flex h-[36px] w-full shrink-0 items-center gap-[12px] border-b border-solid border-border bg-surface-sunken px-[16px] text-2xs font-semibold tracking-[0.4px] text-fg-tertiary">
            <span className="w-[180px] shrink-0">업체</span>
            <span className="w-[90px] shrink-0">분야</span>
            <span className="w-[110px] shrink-0">담당자</span>
            <span className="w-[140px] shrink-0">연락처</span>
            <span className="w-[260px] shrink-0">이메일</span>
            <span className="min-w-0 flex-1">메모</span>
          </div>
          {rows.map((p, i) => {
            const cell = (key: EditableKey, width: string, text: string) => {
              const on = cellEdit?.id === p.id && cellEdit.key === key;
              if (on) {
                const done = () => {
                  const v = cellEdit.value.trim();
                  setCellEdit(null);
                  if (key === 'name' && !v) return;
                  setPartners(partners.map((x) => (x.id === p.id ? { ...x, [key]: v } : x)));
                };
                const keys = {
                  onBlur: done,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' && key !== 'memo') done();
                    if (e.key === 'Escape') setCellEdit(null);
                  },
                };
                return key === 'field' ? (
                  <Select
                    autoFocus
                    value={cellEdit.value}
                    onChange={(e) => setCellEdit({ ...cellEdit, value: e.target.value })}
                    {...keys}
                    variant="chip"
                    size="sm"
                    className={`${width} shrink-0`}
                  >
                    {fields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    autoFocus
                    value={cellEdit.value}
                    onChange={(e) => setCellEdit({ ...cellEdit, value: e.target.value })}
                    {...keys}
                    variant="chip"
                    size="sm"
                    className={`${width} min-w-0`}
                  />
                );
              }
              return (
                <span
                  onDoubleClick={() => setCellEdit({ id: p.id, key, value: text })}
                  title="더블클릭하여 수정"
                  className="min-h-[18px] min-w-0 truncate"
                >
                  {text || <span className="text-fg-tertiary">-</span>}
                </span>
              );
            };
            return (
              <div
                key={p.id}
                className={`group flex w-full shrink-0 items-center gap-[12px] px-[16px] py-[10px] ${i < rows.length - 1 ? 'border-b border-solid border-border' : ''}`}
              >
                <div className="flex w-[180px] shrink-0 items-center text-sm font-semibold text-fg">{cell('name', 'w-full', p.name)}</div>
                <div className={`flex h-[22px] w-[90px] shrink-0 items-center rounded-sm px-[8px] text-2xs font-bold ${PARTNER_FIELD_BADGE}`}>
                  {cell('field', 'w-[80px]', p.field)}
                </div>
                <div className="flex w-[110px] shrink-0 text-xs font-medium text-fg-secondary">{cell('manager', 'w-full', p.manager)}</div>
                <div className="flex w-[140px] shrink-0 text-xs text-fg-secondary">{cell('phone', 'w-full', p.phone)}</div>
                <div className="flex w-[260px] shrink-0 text-xs text-fg-secondary">{cell('email', 'w-full', p.email)}</div>
                <div className="flex min-w-0 flex-1 text-2xs text-fg-tertiary">{cell('memo', 'w-full', p.memo)}</div>
                <button
                  type="button"
                  aria-label={`${p.name} 삭제`}
                  onClick={() => {
                    if (window.confirm(`'${p.name}' 협력사를 삭제할까요?`)) setPartners(partners.filter((x) => x.id !== p.id));
                  }}
                  className="hidden shrink-0 text-xs text-fg-tertiary hover:text-fg group-hover:block"
                >
                  ×
                </button>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="flex w-full items-center justify-center px-[16px] py-[28px]">
              <span className="text-xs text-fg-tertiary">조건에 맞는 협력사가 없습니다.</span>
            </div>
          ) : null}
        </div>
      </div>
      {tagModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setEditing(null);
            setTagModal(false);
          }}
        >
          <div
            role="dialog"
            aria-label="태그 관리"
            onClick={(e) => e.stopPropagation()}
            className="flex w-[360px] flex-col gap-[12px] rounded-lg bg-surface p-[20px]"
          >
            <div className="flex items-center">
              <span className="flex-1 text-sm font-semibold text-fg">태그 관리</span>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => {
                  setEditing(null);
                  setTagModal(false);
                }}
                className="text-xs text-fg-tertiary hover:text-fg"
              >
                ×
              </button>
            </div>
            <div className="flex max-h-[320px] flex-col gap-[6px] overflow-y-auto">
              {fields.map((f) => (
                <div key={f} className="flex items-center gap-[8px]">
                  {editing === f ? (
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      variant="chip"
                      size="sm"
                      className="min-w-0 flex-1"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">
                      {f} <span className="text-2xs text-fg-tertiary">{partners.filter((p) => p.field === f).length}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setDraft(f);
                      setEditing(f);
                    }}
                    className="text-2xs text-fg-tertiary hover:text-fg"
                  >
                    이름 수정
                  </button>
                  <button type="button" onClick={() => remove(f)} className="text-2xs text-fg-tertiary hover:text-fg">
                    삭제
                  </button>
                </div>
              ))}
              {fields.length === 0 ? <span className="text-xs text-fg-tertiary">태그가 없습니다.</span> : null}
            </div>
            <div className="flex items-center gap-[8px]">
              <Input
                value={editing === '' ? draft : ''}
                onFocus={() => {
                  if (editing !== '') {
                    setDraft('');
                    setEditing('');
                  }
                }}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                }}
                placeholder="새 태그"
                variant="chip"
                size="sm"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={commit}
                className="h-[30px] rounded-sm bg-brand px-[12px] text-xs font-medium text-fg-inverse"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setForm(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex w-[440px] flex-col gap-[12px] rounded-lg bg-surface p-[20px]"
          >
            <span className="text-sm font-semibold text-fg">{form.id ? '협력사 수정' : '협력사 추가'}</span>
            {(
              [
                ['name', '업체명'],
                ['manager', '담당자'],
                ['phone', '연락처'],
                ['email', '이메일'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-[4px] text-2xs text-fg-tertiary">
                {label}
                <Input
                  variant="chip"
                  autoFocus={k === 'name'}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
            <label className="flex flex-col gap-[4px] text-2xs text-fg-tertiary">
              분야
              <Select
                variant="chip"
                value={form.field}
                onChange={(e) => setForm({ ...form, field: e.target.value })}
                options={fields.map((f) => ({ value: f, label: f }))}
              />
            </label>
            <label className="flex flex-col gap-[4px] text-2xs text-fg-tertiary">
              메모
              <Textarea
                variant="chip"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
              />
            </label>
            <div className="flex items-center gap-[8px] pt-[4px]">
              {form.id ? (
                <button type="button" onClick={removePartner} className="h-[30px] rounded-sm px-[12px] text-xs text-fg-tertiary hover:text-fg">
                  삭제
                </button>
              ) : null}
              <div className="flex-1" />
              <button type="button" onClick={() => setForm(null)} className="h-[30px] rounded-sm bg-surface-chip px-[12px] text-xs text-fg-secondary">
                취소
              </button>
              <button type="submit" disabled={!form.name.trim()} className="h-[30px] rounded-sm bg-brand px-[12px] text-xs font-medium text-fg-inverse disabled:opacity-40">
                저장
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageFrame>
  );
}
