'use client';

import { useState, type DragEvent, type FormEvent } from 'react';
import { Dialog, StatusPill, type StatusKey } from '@miceplans/ui';
import { EMPTY_ATTR, type EventAttrType, useEventAttrs } from './event-attrs';

const A = '/assets/schedule';

// 목업 기준일('오늘'): 2026-10-22. D-day 계산에 사용하는 고정 상수다.
const MOCK_TODAY = new Date(2026, 9, 22);

export type EventRow = { id: string; name: string; dot: string; startDate: string; endDate: string; priority?: boolean; client: string; pm: string; am: string; design: string; status: StatusKey; place: string; budget?: string };

type ColKey = 'period' | 'client' | 'pm' | 'am' | 'design' | 'status' | 'place';

const COL_DEFS: Record<ColKey, { label: string; icon: string; w: string }> = {
  period: { label: '기간', icon: '7db78', w: 'w-[140px]' },
  client: { label: 'Client', icon: 'fe6d8', w: 'w-[130px]' },
  pm: { label: 'PM', icon: '15302', w: 'w-[65px]' },
  am: { label: 'AM', icon: '15302', w: 'w-[65px]' },
  design: { label: 'Design', icon: '15302', w: 'w-[85px]' },
  status: { label: '상태', icon: 'f8a2c', w: 'w-[110px]' },
  place: { label: '장소', icon: '7bb84', w: 'min-w-px flex-1' },
};

const STATUSES: StatusKey[] = ['진행중', '성공', '확인중', '만료', '제출', '보류중'];

const ATTR_TYPES: { value: EventAttrType; label: string; mark: string }[] = [
  { value: 'text', label: '텍스트', mark: 'Aa' },
  { value: 'number', label: '숫자', mark: '#' },
  { value: 'date', label: '날짜', mark: '□' },
  { value: 'checkbox', label: '체크박스', mark: '✓' },
];

const attrType = (type?: EventAttrType) => ATTR_TYPES.find((item) => item.value === (type ?? 'text'))!;

function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function formatPeriod(start: string, end: string): string {
  const f = (d: string) => d.slice(5).replace('-', '.');
  if (!start) return '';
  return !end || end === start ? f(start) : `${f(start)} – ${f(end)}`;
}

function dDayBadge(startDate: string): { label: string; className: string } | null {
  if (!startDate) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const diff = Math.round((new Date(y, m - 1, d).getTime() - MOCK_TODAY.getTime()) / 86400000);
  if (diff < 0) return { label: '종료', className: 'bg-surface-chip text-fg-secondary' };
  if (diff === 0) return { label: 'D-Day', className: 'bg-brand text-fg-inverse' };
  return { label: `D-${diff}`, className: 'bg-brand-tint text-brand' };
}

const EMPTY_FORM = { name: '', start: '', end: '', client: '', pm: '', am: '', design: '', status: '진행중' as StatusKey, place: '' };

export function EventTable({ initial }: { initial: EventRow[] }) {
  const [rows, setRows] = useState(initial);
  const [cols, setCols] = useState<ColKey[]>(['period', 'client', 'pm', 'am', 'design', 'status', 'place']);
  const [rowDrag, setRowDrag] = useState<{ from: number; over: number } | null>(null);
  const [colDrag, setColDrag] = useState<{ from: ColKey; over: ColKey } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const attrs = useEventAttrs();
  const [attrAdding, setAttrAdding] = useState(false);
  const [attrLabel, setAttrLabel] = useState('');
  const [attrTypeValue, setAttrTypeValue] = useState<EventAttrType>('text');

  const closeAttrDialog = () => {
    setAttrAdding(false);
    setAttrLabel('');
    setAttrTypeValue('text');
  };

  const cell = (e: EventRow, key: ColKey) => {
    if (key === 'status') return <StatusPill status={e.status} />;
    const value = key === 'period' ? formatPeriod(e.startDate, e.endDate) : e[key];
    return <span className={`whitespace-nowrap ${key === 'period' ? 'text-fg-secondary' : 'text-fg'}`}>{value}</span>;
  };

  const onRowDrop = (to: number) => {
    if (rowDrag) setRows((r) => reorder(r, rowDrag.from, to));
    setRowDrag(null);
  };

  const onColDrop = (to: ColKey) => {
    if (colDrag) setCols((c) => reorder(c, c.indexOf(colDrag.from), c.indexOf(to)));
    setColDrag(null);
  };

  const allow = (e: DragEvent) => e.preventDefault();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setRows((r) => [
      ...r,
      {
        id: `new-${Date.now()}`,
        name: form.name.trim(),
        dot: 'b7f4e',
        startDate: form.start,
        endDate: form.end,
        client: form.client,
        pm: form.pm,
        am: form.am,
        design: form.design,
        status: form.status,
        place: form.place,
      },
    ]);
    setForm(EMPTY_FORM);
    setAdding(false);
  };

  const input = 'h-[32px] rounded-[6px] border border-solid border-border bg-surface px-[10px] text-sm text-fg outline-none focus:border-fg-secondary';

  return (
    <div className="mobile-table-scroll flex w-full flex-col items-start bg-surface px-[20px] max-md:px-0">
      {adding && (
        <form onSubmit={submit} className="mb-[12px] grid w-full grid-cols-4 gap-[10px] rounded-[8px] border border-solid border-border bg-surface-sunken p-[14px] max-md:grid-cols-2">
          <input autoFocus required placeholder="행사명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${input} col-span-2`} />
          <input type="date" aria-label="시작일" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={input} />
          <input type="date" aria-label="종료일" value={form.end} min={form.start} onChange={(e) => setForm({ ...form, end: e.target.value })} className={input} />
          <input placeholder="Client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className={input} />
          <input placeholder="PM" value={form.pm} onChange={(e) => setForm({ ...form, pm: e.target.value })} className={input} />
          <input placeholder="AM" value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} className={input} />
          <input placeholder="Design" value={form.design} onChange={(e) => setForm({ ...form, design: e.target.value })} className={input} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusKey })} className={input}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input placeholder="장소" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} className={`${input} col-span-2`} />
          <div className="col-span-2 flex items-center justify-end gap-[8px]">
            <a href="/import/upload" className="mr-auto flex h-[32px] items-center rounded-[6px] border border-solid border-border bg-surface px-[12px] text-sm text-fg no-underline hover:bg-surface-sunken">
              Excel로 가져오기
            </a>
            <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_FORM); }} className="h-[32px] rounded-[6px] px-[12px] text-sm text-fg-secondary hover:bg-surface">
              취소
            </button>
            <button type="submit" className="h-[32px] rounded-[6px] bg-fg px-[14px] text-sm font-medium text-surface">
              행사 추가
            </button>
          </div>
        </form>
      )}

      <div className="flex h-[36px] w-full shrink-0 items-start border-b border-solid border-border bg-surface text-xs font-medium text-fg-secondary">
        <div className="w-[18px] shrink-0" />
        <div className="flex h-full w-[108px] items-center px-[16px]">
          <span className="whitespace-nowrap">우선순위</span>
        </div>
        <div className="flex h-full w-[200px] items-center px-[16px]">
          <span className="whitespace-nowrap">행사명</span>
        </div>
        {cols.map((key) => {
          const col = COL_DEFS[key];
          const isOver = colDrag?.over === key && colDrag.from !== key;
          return (
            <div
              key={key}
              draggable
              onDragStart={() => setColDrag({ from: key, over: key })}
              onDragOver={(e) => { allow(e); if (colDrag && colDrag.over !== key) setColDrag({ ...colDrag, over: key }); }}
              onDrop={() => onColDrop(key)}
              onDragEnd={() => setColDrag(null)}
              className={`flex h-full cursor-grab items-center gap-[6px] px-[16px] ${col.w} ${colDrag?.from === key ? 'opacity-40' : ''} ${isOver ? 'bg-surface-sunken shadow-[inset_2px_0_0_0_currentColor]' : ''}`}
            >
              <img alt="" src={`${A}/${col.icon}.svg`} className="size-[13px]" />
              <span className="whitespace-nowrap">{col.label}</span>
            </div>
          );
        })}
        {attrs.columns.map((col) => (
          <div key={col.id} className="flex h-full w-[110px] items-center px-[16px]">
            <span className="mr-[5px] text-[11px] text-fg-tertiary">{attrType(col.type).mark}</span>
            <span className="whitespace-nowrap">{col.label}</span>
          </div>
        ))}
        <div className="flex h-full w-[36px] shrink-0 items-center justify-center">
          <button type="button" aria-label="행사 추가" title="행사 추가" onClick={() => setAdding((v) => !v)} className="flex size-[22px] items-center justify-center rounded-[4px] text-base leading-none hover:bg-surface-sunken">
            +
          </button>
        </div>
        <div className="flex h-full w-[36px] shrink-0 items-center justify-center">
          <button type="button" aria-label="속성 추가" title="속성 추가" onClick={() => setAttrAdding(true)} className="flex size-[22px] items-center justify-center rounded-[4px] text-base leading-none hover:bg-surface-sunken">
            +
          </button>
        </div>
      </div>

      {rows.map((e, i) => {
        const dragging = rowDrag?.from === i;
        const over = rowDrag && rowDrag.over === i && rowDrag.from !== i;
        const dDay = e.priority ? dDayBadge(e.startDate) : null;
        return (
          <a
            key={e.id}
            href={`/events/${e.id}`}
            aria-label={`${e.name} 상세 보기`}
            onDragOver={(ev) => { allow(ev); if (rowDrag && rowDrag.over !== i) setRowDrag({ ...rowDrag, over: i }); }}
            onDrop={() => onRowDrop(i)}
            className={`flex w-full shrink-0 cursor-pointer items-center border-x border-b border-solid border-border px-[10px] text-base no-underline outline-none hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset ${dragging ? 'opacity-40' : ''} ${over ? (rowDrag!.from < i ? 'shadow-[inset_0_-2px_0_0_currentColor]' : 'shadow-[inset_0_2px_0_0_currentColor]') : ''}`}
          >
            <img
              alt="순서 변경"
              src={`${A}/14024.svg`}
              draggable
              onClick={(event) => event.stopPropagation()}
              onDragStart={(ev) => {
                const row = ev.currentTarget.parentElement;
                if (row) ev.dataTransfer.setDragImage(row, 10, 22);
                ev.dataTransfer.effectAllowed = 'move';
                setRowDrag({ from: i, over: i });
              }}
              onDragEnd={() => setRowDrag(null)}
              className="size-[18px] shrink-0 cursor-grab active:cursor-grabbing"
            />
            <div className="flex h-[44px] min-w-px flex-1 items-start">
              <div className="flex h-full w-[108px] items-center gap-[6px] px-[12px]">
                <span className="w-[12px] text-xs font-medium text-fg-secondary">{i + 1}</span>
                {dDay ? (
                  <span className={`flex h-[18px] items-center justify-center whitespace-nowrap rounded-sm px-[6px] text-2xs font-bold ${dDay.className}`}>
                    {dDay.label}
                  </span>
                ) : null}
              </div>
              <div className="flex h-full w-[200px] items-center gap-[4px] px-[16px] font-medium text-fg">
                <img alt="" src={`${A}/${e.dot}.svg`} className="size-[13px] shrink-0" />
                <span className="whitespace-nowrap">{e.name}</span>
              </div>
              {cols.map((key) => (
                <div key={key} className={`flex h-full items-center px-[16px] ${COL_DEFS[key].w}`}>
                  {cell(e, key)}
                </div>
              ))}
              {attrs.columns.map((col) => (
                <div key={col.id} className="flex h-full w-[110px] items-center px-[16px]">
                  <AttrCell
                    type={col.type}
                    value={attrs.getValue(e.id, col.id) ?? (e as unknown as Record<string, string | undefined>)[col.id]}
                    onSave={(v) => attrs.setValue(e.id, col.id, v)}
                  />
                </div>
              ))}
              <div className="h-full w-[36px] shrink-0" />
              <div className="h-full w-[36px] shrink-0" />
            </div>
          </a>
        );
      })}
      {attrAdding ? (
        <Dialog onClose={() => setAttrAdding(false)}>
          <form
            role="dialog"
            aria-label="새 속성"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!attrLabel.trim()) return;
              attrs.addColumn(attrLabel, attrTypeValue);
              closeAttrDialog();
            }}
            className="flex w-[400px] max-w-full flex-col overflow-hidden rounded-xl border border-solid border-border bg-surface shadow-card"
          >
            <div className="border-b border-solid border-border px-[20px] py-[17px]">
              <p className="m-0 text-xs font-medium text-fg-tertiary">행사 데이터베이스</p>
              <h2 className="m-[3px_0_0] text-lg font-semibold text-fg">새 속성</h2>
            </div>
            <div className="flex flex-col gap-[16px] px-[20px] py-[18px]">
              <label className="flex flex-col gap-[7px] text-sm font-medium text-fg">
                속성 이름
                <input autoFocus required value={attrLabel} onChange={(e) => setAttrLabel(e.target.value)} placeholder="예: 계약 상태" className="h-[40px] rounded-md border border-solid border-border bg-surface px-[11px] text-base font-normal text-fg outline-none placeholder:text-fg-tertiary focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </label>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-[7px] text-sm font-medium text-fg">유형</legend>
                <div role="radiogroup" aria-label="속성 유형" className="grid grid-cols-2 gap-[8px]">
                  {ATTR_TYPES.map((item) => {
                    const selected = item.value === attrTypeValue;
                    return <button key={item.value} type="button" role="radio" aria-checked={selected} onClick={() => setAttrTypeValue(item.value)} className={`flex h-[42px] items-center gap-[8px] rounded-md border px-[10px] text-sm font-medium ${selected ? 'border-brand bg-brand-tint text-brand' : 'border-border text-fg hover:bg-surface-subtle'}`}><span className="w-[18px] text-center text-xs">{item.mark}</span>{item.label}</button>;
                  })}
                </div>
              </fieldset>
              <p className="m-0 text-xs leading-[18px] text-fg-tertiary">추가한 속성은 모든 행사 표에 표시됩니다.</p>
            </div>
            <div className="flex justify-end gap-[8px] border-t border-solid border-border px-[20px] py-[14px]">
              <button type="button" onClick={closeAttrDialog} className="h-[34px] rounded-md px-[13px] text-sm font-medium text-fg-secondary hover:bg-surface-subtle">
                취소
              </button>
              <button type="submit" className="h-[34px] rounded-md bg-brand px-[14px] text-sm font-semibold text-fg-inverse hover:opacity-90">
                추가
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

/** 사용자 정의 속성 셀. 클릭하면 값을 편집할 수 있고, 빈 값은 —로 표시한다. */
function AttrCell({ type = 'text', value, onSave }: { type?: EventAttrType; value?: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (type === 'checkbox') {
    return <input type="checkbox" aria-label="체크박스 속성" checked={value === 'true'} onClick={(e) => { e.preventDefault(); onSave(value === 'true' ? '' : 'true'); }} onChange={() => undefined} className="size-[16px] accent-brand" />;
  }

  if (!editing) {
    return (
      <button
        type="button"
        title={value?.trim() ? '클릭해서 수정' : '클릭해서 입력'}
        onClick={(e) => {
          e.preventDefault();
          setDraft(value ?? '');
          setEditing(true);
        }}
        className={`whitespace-nowrap text-left text-base hover:underline ${value?.trim() ? 'text-fg' : 'text-fg-tertiary'}`}
      >
        {value?.trim() ? value : EMPTY_ATTR}
      </button>
    );
  }

  const save = () => {
    setEditing(false);
    onSave(draft.trim());
  };

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.preventDefault()}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          setDraft(value ?? '');
          setEditing(false);
        }
      }}
      className="h-[28px] w-full rounded-sm border border-solid border-border bg-surface px-[6px] text-base text-fg outline-none focus:border-fg-secondary"
    />
  );
}
