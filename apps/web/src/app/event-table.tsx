'use client';

import { useState, type DragEvent, type FormEvent } from 'react';
import { StatusPill, type StatusKey } from '@miceplans/ui';

const A = '/assets/schedule';

export type EventRow = { id: string; name: string; dot: string; period: string; client: string; pm: string; am: string; status: StatusKey; place: string };

type ColKey = 'period' | 'client' | 'pm' | 'am' | 'status' | 'place';

const COL_DEFS: Record<ColKey, { label: string; icon: string; w: string }> = {
  period: { label: '기간', icon: '7db78', w: 'w-[140px]' },
  client: { label: 'Client', icon: 'fe6d8', w: 'w-[130px]' },
  pm: { label: 'PM', icon: '15302', w: 'w-[65px]' },
  am: { label: 'AM', icon: '15302', w: 'w-[65px]' },
  status: { label: '상태', icon: 'f8a2c', w: 'w-[110px]' },
  place: { label: '장소', icon: '7bb84', w: 'min-w-px flex-1' },
};

const STATUSES: StatusKey[] = ['진행중', '성공', '확인중', '만료', '제출', '보류중'];

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

const EMPTY_FORM = { name: '', start: '', end: '', client: '', pm: '', am: '', status: '진행중' as StatusKey, place: '' };

export function EventTable({ initial }: { initial: EventRow[] }) {
  const [rows, setRows] = useState(initial);
  const [cols, setCols] = useState<ColKey[]>(['period', 'client', 'pm', 'am', 'status', 'place']);
  const [rowDrag, setRowDrag] = useState<{ from: number; over: number } | null>(null);
  const [colDrag, setColDrag] = useState<{ from: ColKey; over: ColKey } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const cell = (e: EventRow, key: ColKey) => {
    if (key === 'status') return <StatusPill status={e.status} />;
    const value = key === 'period' ? e.period : e[key];
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
        period: formatPeriod(form.start, form.end),
        client: form.client,
        pm: form.pm,
        am: form.am,
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
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusKey })} className={input}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input placeholder="장소" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} className={`${input} col-span-2`} />
          <div className="col-span-2 flex justify-end gap-[8px]">
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
        <div className="flex h-full w-[52px] items-center px-[16px]">
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
        <div className="flex h-full w-[36px] shrink-0 items-center justify-center">
          <button type="button" aria-label="행사 추가" title="행사 추가" onClick={() => setAdding((v) => !v)} className="flex size-[22px] items-center justify-center rounded-[4px] text-base leading-none hover:bg-surface-sunken">
            +
          </button>
        </div>
      </div>

      {rows.map((e, i) => {
        const dragging = rowDrag?.from === i;
        const over = rowDrag && rowDrag.over === i && rowDrag.from !== i;
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
              <div className="flex h-full w-[52px] items-center px-[16px] text-xs font-medium text-fg-secondary">
                <span className="w-[45px]">{i + 1}</span>
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
              <div className="h-full w-[36px] shrink-0" />
            </div>
          </a>
        );
      })}
    </div>
  );
}
