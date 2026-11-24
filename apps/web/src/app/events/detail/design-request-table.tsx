'use client';

import { useState } from 'react';
import { Checkbox, ConfirmDialog, Input, StatusPill } from '@miceplans/ui';
import { AddPropertyButton, PROP_COL_WIDTH, PropCell, PropHeaderCell, useCustomProps } from './custom-props';
import { ProductNameCombobox } from './product-name-combobox';
import { matchPart, type PartFilter } from './event-parts';
import type { ProductCatalogItem } from './product-catalog';
import {
  CELL,
  FIELDS,
  HEAD,
  LINE,
  WIDTHS,
  downloadDesignRequests,
  type RequestRow,
  type Team,
} from './event-products-model';
import { Required, TableTitle } from './product-table-ui';

const A = '/assets/event-detail';

const INITIAL_ROWS: Record<Team, RequestRow[]> = { planning: [], design: [] };

/** 디자인 요청 표의 더보기 메뉴. 업로드·다운로드는 파일 기능 구현 전까지 메뉴로만 닫는다. */
function MoreMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        aria-label="더보기"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-[24px] items-center justify-center rounded-md hover:bg-surface-chip"
      >
        <img alt="" src={`${A}/more-vert.svg`} className="size-[24px]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-[4px] flex flex-col rounded-lg bg-surface shadow-card">
          {[
            { icon: 'ios-share', label: '파일 업로드' },
            { icon: 'download', label: '파일 다운로드' },
          ].map((m) => (
            <button
              key={m.icon}
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-[4px] whitespace-nowrap rounded-lg p-[8px] text-left text-[15px] text-fg-secondary hover:bg-surface-subtle"
            >
              <img alt="" src={`${A}/${m.icon}.svg`} className="size-[19px]" />
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 디자인 요청: 기획팀은 항목을 추가·편집하고, 디자인팀은 요청을 승인·반려한다. */
export function DesignRequestTable({ team, part = '전체', eventName = '행사', eventId = 'default', rows: controlledRows, onRowsChange }: { team: Team; part?: PartFilter; eventName?: string; eventId?: string; rows?: RequestRow[]; onRowsChange?: (rows: RequestRow[]) => void }) {
  const cp = useCustomProps(`${eventId}:design-request`);
  const [ownRows, setOwnRows] = useState(INITIAL_ROWS[team]);
  const rows = controlledRows ?? ownRows;
  const setRows = (next: RequestRow[] | ((rows: RequestRow[]) => RequestRow[])) => {
    const value = typeof next === 'function' ? next(rows) : next;
    if (onRowsChange) onRowsChange(value);
    else setOwnRows(value);
  };
  const planning = team === 'planning';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = matchPart(rows, part);
  const deletingRow = deletingId ? (rows.find((r) => r.id === deletingId) ?? null) : null;

  const update = (id: string, patch: Partial<RequestRow>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setRows((list) => list.filter((r) => r.id !== id));
  const duplicate = (r: RequestRow) =>
    setRows((list) => [...list, { ...r, id: `n${Date.now()}`, status: 'draft' }]);
  const add = () =>
    setRows((list) => [
      ...list,
      { id: `n${Date.now()}`, name: '', part: '디자인', due: '', size: '', qty: '', material: '', vendor: '', contact: '', note: '', negotiating: false, status: 'draft' },
    ]);

  const canDownload = !planning || part === '디자인';

  return (
    <section className="flex w-full flex-col gap-[12px]">
      <div className="flex items-center gap-[12px]">
        <TableTitle>디자인 요청</TableTitle>
        <AddPropertyButton onAdd={cp.addProp} />
        <span className="flex-1" />
        {canDownload && (
          <button
            type="button"
            onClick={() => downloadDesignRequests(eventName, visible)}
            className="flex h-[32px] items-center gap-[6px] rounded-sm border border-solid border-border px-[12px] text-base font-medium text-fg-secondary hover:bg-surface-subtle"
          >
            <img alt="" src={`${A}/download.svg`} className="size-[16px]" />
            요청 목록 다운로드
          </button>
        )}
        {planning && (
          <div className="flex items-center gap-[12px]">
            <MoreMenu />
            <button type="button" onClick={add} className="flex items-center gap-[4px] rounded-lg bg-brand p-[8px] text-[15px] text-fg-inverse">
              <img alt="" src={`${A}/add.svg`} className="size-[18px]" />
              새 항목 추가
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="flex flex-col" style={{ minWidth: 1180 + cp.props.length * PROP_COL_WIDTH }}>
          <div className={`flex items-center gap-[12px] rounded-t-lg px-[14px] py-[8px] ${HEAD}`}>
            <span className={`${CELL} w-[120px]`}>품명</span>
            <span className={`${CELL} w-[70px]`}>파트</span>
            <span className={`${CELL} w-[80px]`}>마감일</span>
            <span className={`${CELL} w-[100px]`}>사이즈 <Required /></span>
            <span className={`${CELL} w-[85px]`}>수량</span>
            <span className={`${CELL} w-[85px]`}>재질 <Required /></span>
            <span className={`${CELL} w-[140px]`}>발주업체</span>
            <span className={`${CELL} w-[180px]`}>업체 담당자(연락처)</span>
            <span className={`${CELL} w-[120px]`}>비고</span>
            <span className={`${CELL} w-[80px]`}>협의중</span>
            {cp.props.map((p) => (
              <PropHeaderCell key={p.id} prop={p} className={CELL} onRename={(n) => cp.renameProp(p.id, n)} onRemove={() => cp.removeProp(p.id)} />
            ))}
            <span className={`${CELL} w-[84px]`}>{planning ? '상태/기능' : '승인'}</span>
          </div>
          {visible.map((r, i) => {
            const draft = r.status === 'draft';
            const editing = draft || r.id === editingId;
            return (
              <div
                key={r.id}
                // 디자인팀은 받은 요청을 더블클릭해 수정한다. Enter·Esc 또는 행 밖으로 포커스가 나가면 끝난다.
                onDoubleClick={(e) => {
                  if (planning || draft) return;
                  setEditingId(r.id);
                  const target = e.currentTarget;
                  requestAnimationFrame(() => target.querySelector('input')?.focus());
                }}
                onKeyDown={(e) => { if (r.id === editingId && (e.key === 'Enter' || e.key === 'Escape')) setEditingId(null); }}
                onBlur={(e) => { if (r.id === editingId && !e.currentTarget.contains(e.relatedTarget)) setEditingId(null); }}
                className={`flex items-center gap-[12px] border-0 border-x border-b border-solid bg-surface px-[14px] py-[10px] ${LINE} ${i === visible.length - 1 ? 'rounded-b-lg' : ''}`}
              >
                {FIELDS.map((f, fi) =>
                  editing ? (
                    f === 'name' ? (
                      <ProductNameCombobox
                        key={f}
                        value={r.name}
                        onChange={(name) => update(r.id, { name })}
                        onSelect={(item: ProductCatalogItem) =>
                          update(r.id, {
                            name: item.name,
                            size: item.size || r.size,
                            material: item.material || r.material,
                            vendor: item.vendor || r.vendor,
                            contact: item.contact || r.contact,
                          })
                        }
                      />
                    ) : (
                      <Input
                        key={f}
                        aria-label={f}
                        value={r[f]}
                        onChange={(e) => update(r.id, { [f]: e.target.value })}
                        size="lg"
                        className={`${WIDTHS[fi]} shrink-0`}
                      />
                    )
                  ) : (
                    <span key={f} className={`${CELL} ${WIDTHS[fi]} ${fi === 0 ? 'justify-between pr-[14px]' : ''}`}>
                      {r[f]}
                      {fi === 0 && <img alt="" src={`${A}/role-chevron.svg`} className="size-[14px]" />}
                    </span>
                  ),
                )}
                <span className={`${CELL} w-[70px] text-fg-secondary`}>{r.part}</span>
                <span className={`${CELL} w-[80px]`}>{r.due}</span>
                <span className="flex h-[40px] w-[80px] shrink-0 items-center px-[8px]">
                  <Checkbox
                    aria-label="협의중"
                    checked={r.negotiating}
                    onChange={(e) => update(r.id, { negotiating: e.target.checked })}
                  />
                </span>
                {cp.props.map((p) => (
                  <PropCell key={p.id} prop={p} value={cp.getValue(r.id, p.id)} onChange={(v) => cp.setValue(r.id, p.id, v)} />
                ))}
                <span className="flex shrink-0 items-center gap-[5.5px]">
                  {r.status === 'reject' && (
                    <span className="flex h-[24px] shrink-0 items-center gap-[4px] rounded-md px-[8px] text-xs font-bold bg-reject-bg text-reject">
                      <img alt="" src={`${A}/pill-reject.svg`} className="size-[14px]" />
                      반려
                    </span>
                  )}
                  {r.status === 'success' && <StatusPill status="성공" />}
                  {r.status === 'pending' && (
                    <>
                      <button type="button" aria-label="승인" onClick={() => update(r.id, { status: 'success' })}>
                        <img alt="" src={`${A}/approve.svg`} className="size-[30px]" />
                      </button>
                      <button type="button" aria-label="반려" onClick={() => update(r.id, { status: 'reject' })}>
                        <img alt="" src={`${A}/reject.svg`} className="size-[30px]" />
                      </button>
                    </>
                  )}
                  {draft && (
                    <>
                      <button type="button" aria-label="행 복제" onClick={() => duplicate(r)}>
                        <img alt="" src={`${A}/row-copy.svg`} className="size-[22px]" />
                      </button>
                      <button type="button" aria-label="행 삭제" onClick={() => setDeletingId(r.id)}>
                        <img alt="" src={`${A}/row-delete.svg`} className="size-[22px]" />
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {!visible.length && <p className={`m-0 border-0 border-x border-b border-solid bg-surface px-[22px] py-[12px] text-[15px] text-fg-tertiary ${LINE} rounded-b-lg`}>해당 파트의 요청이 없습니다.</p>}
        </div>
      </div>
      {deletingRow && (
        <ConfirmDialog
          title={`'${deletingRow.name || '요청 항목'}'을(를) 삭제할까요?`}
          body="삭제한 요청은 복구할 수 없습니다."
          onClose={() => setDeletingId(null)}
          onConfirm={() => {
            remove(deletingRow.id);
            setDeletingId(null);
          }}
        />
      )}
    </section>
  );
}
