'use client';

import { Fragment, useRef, useState } from 'react';
import { Checkbox, ConfirmDialog, Input, Select, StatusPill, toast } from '@miceplans/ui';
import { AddPropertyButton, PROP_COL_WIDTH, PropCell, PropHeaderCell, useCustomProps } from './custom-props';
import { ProductNameCombobox } from './product-name-combobox';
import { PART_FILTERS, matchPart, type PartFilter, type ProductPart } from './event-parts';
import type { ProductCatalogItem } from './product-catalog';
import {
  CELL,
  FIELDS,
  HEAD,
  LINE,
  WIDTHS,
  canRequest,
  downloadDesignRequests,
  missingFields,
  type RequestRow,
  type Team,
} from './event-products-model';
import { Required, TableTitle } from './product-table-ui';

const A = '/assets/event-detail';

const PART_OPTIONS = PART_FILTERS.filter((p): p is ProductPart => p !== '전체').map((p) => ({ value: p, label: p }));

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

/** 디자인 요청: 행사 멤버는 팀과 상관없이 항목을 추가·수정하고(명세 F-04), 그 밖의 직원은 보기만 한다. 승인·반려도 행사 멤버만 한다. */
export function DesignRequestTable({ team, canEdit, part = '전체', eventName = '행사', eventId = 'default', rows: controlledRows, onRowsChange }: { team: Team; canEdit: boolean; part?: PartFilter; eventName?: string; eventId?: string; rows?: RequestRow[]; onRowsChange?: (rows: RequestRow[]) => void }) {
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
  const tableRef = useRef<HTMLDivElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = matchPart(rows, part);
  const deletingRow = deletingId ? (rows.find((r) => r.id === deletingId) ?? null) : null;

  const update = (id: string, patch: Partial<RequestRow>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setRows((list) => list.filter((r) => r.id !== id));
  const duplicate = (r: RequestRow) =>
    setRows((list) => [...list, { ...r, id: crypto.randomUUID(), status: 'draft' }]);
  const add = () =>
    setRows((list) => [
      ...list,
      { id: crypto.randomUUID(), name: '', part: part === '전체' ? '디자인' : part, due: '', size: '', qty: '', material: '', vendor: '', contact: '', note: '', negotiating: false, status: 'draft' },
    ]);

  /** 작성 중·반려 요청을 승인 대기로 보낸다. 필수 항목이 비어 있으면 보내지 않는다. */
  const requestApproval = (r: RequestRow) => {
    const missing = missingFields(r);
    if (missing.length) {
      toast.error(`${missing.join('·')}을(를) 입력해야 요청할 수 있습니다.`);
      return;
    }
    update(r.id, { status: 'pending' });
    setEditingId(null);
  };
  const startEdit = (id: string) => {
    setEditingId(id);
    requestAnimationFrame(() => tableRef.current?.querySelector<HTMLInputElement>(`[data-row-id="${id}"] input`)?.focus());
  };

  const canDownload = !planning || part === '디자인';

  return (
    <section className="flex w-full flex-col gap-[12px]">
      <div className="flex items-center gap-[12px]">
        <TableTitle>디자인 요청</TableTitle>
        {canEdit && <AddPropertyButton onAdd={cp.addProp} />}
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
        {canEdit && (
          <div className="flex items-center gap-[12px]">
            {planning && <MoreMenu />}
            <button type="button" onClick={add} className="flex items-center gap-[4px] rounded-lg bg-brand p-[8px] text-[15px] text-fg-inverse">
              <img alt="" src={`${A}/add.svg`} className="size-[18px]" />
              새 항목 추가
            </button>
          </div>
        )}
      </div>
      {!canEdit && <p className="m-0 text-sm text-fg-tertiary">행사 멤버만 디자인 요청을 추가·수정할 수 있습니다.</p>}
      <div ref={tableRef} className="overflow-x-auto">
        <div className="flex flex-col" style={{ minWidth: 1480 + cp.props.length * PROP_COL_WIDTH }}>
          <div className={`flex items-center gap-[12px] rounded-t-lg px-[14px] py-[8px] ${HEAD}`}>
            <span className={`${CELL} w-[120px]`}>품명</span>
            <span className={`${CELL} w-[90px]`}>파트</span>
            <span className={`${CELL} w-[150px]`}>마감일</span>
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
            <span className={`${CELL} w-[180px]`}>{planning ? '상태/기능' : '승인'}</span>
          </div>
          {visible.map((r, i) => {
            const draft = r.status === 'draft';
            const editing = canEdit && (draft || r.id === editingId);
            return (
              <div
                key={r.id}
                data-row-id={r.id}
                // 작성이 끝난 요청은 수정 버튼이나 더블클릭으로 고친다. Enter·Esc 또는 완료 버튼으로 끝낸다.
                // 파트 선택 팝업처럼 행 밖에 그려지는 입력이 있어 포커스 이탈로는 끝내지 않는다.
                onDoubleClick={() => {
                  if (canEdit && !draft && !editing) startEdit(r.id);
                }}
                onKeyDown={(e) => {
                  if (r.id !== editingId || !(e.target instanceof HTMLInputElement) || !e.currentTarget.contains(e.target) || e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null);
                }}
                className={`flex items-center gap-[12px] border-0 border-x border-b border-solid bg-surface px-[14px] py-[10px] ${LINE} ${i === visible.length - 1 ? 'rounded-b-lg' : ''}`}
              >
                {FIELDS.map((f, fi) => {
                  const cell = editing ? (
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
                  );
                  // 머리글 순서(품명 · 파트 · 마감일 · 사이즈 …)에 맞춰 품명 뒤에 파트·마감일을 둔다.
                  return fi === 0 ? (
                    <Fragment key={f}>
                      {cell}
                      {editing ? (
                        <>
                          <Select aria-label="파트" value={r.part} onChange={(e) => update(r.id, { part: e.target.value })} options={PART_OPTIONS} size="lg" className="w-[90px] shrink-0" />
                          <Input aria-label="마감일" type="date" value={r.due} onChange={(e) => update(r.id, { due: e.target.value })} size="lg" className="w-[150px] shrink-0" />
                        </>
                      ) : (
                        <>
                          <span className={`${CELL} w-[90px] text-fg-secondary`}>{r.part}</span>
                          <span className={`${CELL} w-[150px] whitespace-nowrap`}>{r.due}</span>
                        </>
                      )}
                    </Fragment>
                  ) : cell;
                })}
                <span className="flex h-[40px] w-[80px] shrink-0 items-center px-[8px]">
                  <Checkbox
                    aria-label="협의중"
                    checked={r.negotiating}
                    disabled={!canEdit}
                    onChange={(e) => update(r.id, { negotiating: e.target.checked })}
                  />
                </span>
                {cp.props.map((p) => (
                  <PropCell key={p.id} prop={p} value={cp.getValue(r.id, p.id)} onChange={(v) => cp.setValue(r.id, p.id, v)} />
                ))}
                <span className="flex w-[180px] shrink-0 items-center gap-[5.5px]">
                  {r.status === 'reject' && (
                    <span className="flex h-[24px] shrink-0 items-center gap-[4px] rounded-md px-[8px] text-xs font-bold bg-reject-bg text-reject">
                      <img alt="" src={`${A}/pill-reject.svg`} className="size-[14px]" />
                      반려
                    </span>
                  )}
                  {r.status === 'success' && <StatusPill status="성공" />}
                  {canEdit && r.status === 'pending' && (
                    <>
                      <button type="button" aria-label="승인" onClick={() => update(r.id, { status: 'success' })}>
                        <img alt="" src={`${A}/approve.svg`} className="size-[30px]" />
                      </button>
                      <button type="button" aria-label="반려" onClick={() => update(r.id, { status: 'reject' })}>
                        <img alt="" src={`${A}/reject.svg`} className="size-[30px]" />
                      </button>
                    </>
                  )}
                  {canEdit && canRequest(r) && (
                    <button
                      type="button"
                      aria-label={`${r.name || '요청 항목'} ${draft ? '승인 요청' : '다시 요청'}`}
                      onClick={() => requestApproval(r)}
                      className="flex h-[24px] shrink-0 items-center rounded-sm bg-brand px-[8px] text-2xs font-medium text-fg-inverse"
                    >
                      {draft ? '승인 요청' : '다시 요청'}
                    </button>
                  )}
                  {canEdit && !draft && editing && (
                    <button type="button" onClick={() => setEditingId(null)} className="flex h-[24px] shrink-0 items-center rounded-sm bg-surface-chip px-[8px] text-2xs text-fg-secondary hover:text-fg">
                      완료
                    </button>
                  )}
                  {canEdit && !draft && !editing && (
                    <button
                      type="button"
                      aria-label={`${r.name || '요청 항목'} 수정`}
                      onClick={() => startEdit(r.id)}
                      className="flex h-[24px] items-center rounded-sm bg-surface-chip px-[8px] text-2xs text-fg-secondary hover:text-fg"
                    >
                      수정
                    </button>
                  )}
                  {canEdit && draft && (
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
