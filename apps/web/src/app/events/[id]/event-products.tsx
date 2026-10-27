'use client';

import { useState, type ReactNode } from 'react';

import { ConfirmDialog, StatusPill, type StatusKey } from '@miceplans/ui';
import { AddPropertyButton, PROP_COL_WIDTH, PropCell, PropHeaderCell, useCustomProps } from './custom-props';
import { ProductNameCombobox } from './product-name-combobox';
import { matchPart, type PartFilter, type ProductPart } from './event-parts';
import type { ProductCatalogItem } from './product-catalog';

const A = '/assets/event-detail';

export type Team = 'planning' | 'design';

type RequestStatus = 'pending' | 'reject' | 'success' | 'draft';

type RequestRow = {
  id: string;
  name: string;
  part: ProductPart;
  due: string;
  size: string;
  qty: string;
  material: string;
  vendor: string;
  contact: string;
  note: string;
  negotiating: boolean;
  status: RequestStatus;
};

const row = (id: string, status: RequestStatus, vendor = '스피드', part: ProductPart = '디자인', due = '03.10'): RequestRow => ({
  id,
  name: '명찰',
  part,
  due,
  size: '400×300',
  qty: '3개',
  material: '거칠거칠',
  vendor,
  contact: '055-0203-0211',
  note: '',
  negotiating: false,
  status,
});

const INITIAL_ROWS: Record<Team, RequestRow[]> = {
  planning: [row('r1', 'reject', '스피드', '디자인', '03.05'), row('r2', 'reject', '스피드', '영상', '03.15'), row('r3', 'draft', '', '디자인', '03.20')],
  design: [row('r1', 'pending', '스피드', '디자인', '03.05'), row('r2', 'reject', '모듈랩', '3D', '03.08'), row('r3', 'success', '스피드', '디자인', '03.02')],
};

const HEAD = 'bg-surface-cell';
const LINE = 'border-border-strong';
const CELL = 'flex h-[40px] shrink-0 items-center rounded-lg px-[8px] text-[15px] text-fg';

function Required() {
  return <span className="text-brand">*</span>;
}

function TableTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-lg font-semibold text-black">{children}</h2>;
}

type ProgressRow = {
  id: string;
  name: string;
  part: ProductPart;
  due: string; // 마감일 (MM.DD)
  doneAt: string | null; // 완료일. 미완료면 null
  size: string;
  qty: string;
  status: StatusKey;
  owner: string;
  material: string;
  vendor: string;
  contact: string;
  note: string;
};

const PROGRESS_ROWS: ProgressRow[] = [
  { id: 'p1', name: '메인 포스터', part: '디자인', due: '03.04', doneAt: '03.02', size: 'A1', qty: '10장', status: '성공', owner: '이하은', material: '아트지 150g', vendor: '정운기획', contact: '010-3864-1036', note: '' },
  { id: 'p2', name: '명찰', part: '디자인', due: '03.06', doneAt: null, size: '400×300', qty: '3개', status: '진행중', owner: '김민수', material: '거칠거칠', vendor: '스피드', contact: '055-0203-0211', note: '' },
  { id: 'p3', name: 'X-배너', part: '디자인', due: '03.10', doneAt: null, size: '600×1800', qty: '4개', status: '보류중', owner: '이하은', material: 'PVC, PET', vendor: '스피드', contact: '051-747-7277', note: '현장 실측 필요' },
  { id: 'p4', name: '오프닝 영상', part: '영상', due: '03.12', doneAt: null, size: '30초', qty: '1편', status: '진행중', owner: '오세민', material: '-', vendor: '스튜디오M', contact: '010-5555-0111', note: '' },
  { id: 'p5', name: '부스 구조', part: '3D', due: '03.08', doneAt: '03.07', size: '3×3m', qty: '1개', status: '제출', owner: '윤서준', material: '목재', vendor: '모듈랩', contact: '010-2222-0333', note: '안전 검토 중' },
];

type ProgressSort = '완료일순' | '마감일순' | '상태순';

const SORT_OPTIONS: { value: ProgressSort; label: string }[] = [
  { value: '완료일순', label: '완료일 빠른 순' },
  { value: '마감일순', label: '마감일 빠른 순' },
  { value: '상태순', label: '상태 순' },
];

const STATUS_ORDER: Record<StatusKey, number> = { 진행중: 0, 제출: 1, 확인중: 2, 보류중: 3, 만료: 4, 성공: 5 };

/** 기본 정렬은 완료일(없으면 마감일) 빠른 순, 날짜가 없는 행은 뒤로 볂는다. */
function sortProgress(rows: ProgressRow[], sort: ProgressSort): ProgressRow[] {
  const key = (r: ProgressRow) => (sort === '완료일순' ? r.doneAt ?? r.due : r.due);
  return [...rows].sort((a, b) => {
    if (sort === '상태순') return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    const ka = key(a);
    const kb = key(b);
    if (!ka && !kb) return 0;
    if (!ka) return 1;
    if (!kb) return -1;
    return ka.localeCompare(kb);
  });
}

/** 진행상황: 행사 전체 제작물의 현재 상태를 보여준다. 디자인팀은 행마다 의견을 별낼 수 있다. */
export function ProgressTable({ team, part = '전체', eventId = 'default' }: { team: Team; part?: PartFilter; eventId?: string }) {
  const design = team === 'design';
  const cp = useCustomProps(`${eventId}:progress`);
  const [sort, setSort] = useState<ProgressSort>('완료일순');
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const rows = sortProgress(matchPart(PROGRESS_ROWS, part), sort);

  // TODO: 의견 전송 API·데이터 모델이 확정되면 연결한다. 지금은 입력창만 닫는다.
  const send = () => {
    if (!comment.trim()) return;
    setComment('');
    setCommentFor(null);
  };

  return (
    <section className="flex w-full flex-col gap-[12px]">
      <div className="flex items-center gap-[12px]">
        <TableTitle>진행상황</TableTitle>
        <AddPropertyButton onAdd={cp.addProp} />
        <span className="flex-1" />
        <label className="flex items-center gap-[6px] text-sm text-fg-secondary">
          정렬
          <select
            aria-label="정렬 기준"
            value={sort}
            onChange={(e) => setSort(e.target.value as ProgressSort)}
            className="h-[30px] rounded-sm border border-solid border-border bg-surface px-[8px] text-xs text-fg"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <div className="flex flex-col" style={{ minWidth: 1240 + cp.props.length * PROP_COL_WIDTH }}>
          <div className={`flex items-center gap-[12px] rounded-t-lg px-[14px] py-[8px] ${HEAD}`}>
            <span className={`${CELL} w-[120px]`}>품명</span>
            <span className={`${CELL} w-[70px]`}>파트</span>
            <span className={`${CELL} w-[80px]`}>마감일</span>
            <span className={`${CELL} w-[80px]`}>완료일</span>
            <span className={`${CELL} w-[100px]`}>사이즈 <Required /></span>
            <span className={`${CELL} w-[85px]`}>수량</span>
            <span className={`${CELL} w-[85px]`}>상태</span>
            <span className={`${CELL} w-[85px]`}>담당자</span>
            <span className={`${CELL} w-[84px]`}>재질 <Required /></span>
            <span className={`${CELL} w-[140px]`}>발주업체</span>
            <span className={`${CELL} w-[180px]`}>업체 담당자(연락처)</span>
            <span className={`${CELL} w-[120px]`}>비고</span>
            {cp.props.map((p) => (
              <PropHeaderCell key={p.id} prop={p} className={CELL} onRename={(n) => cp.renameProp(p.id, n)} onRemove={() => cp.removeProp(p.id)} />
            ))}
            {design && <span className={`${CELL} w-[90px]`}>의견</span>}
          </div>
          <div className={`flex flex-col gap-[10px] rounded-b-lg border border-solid bg-surface px-[14px] py-[10px] ${LINE}`}>
            {!rows.length && <p className="m-0 px-[8px] py-[6px] text-[15px] text-fg-tertiary">해당 파트의 제작물이 없습니다.</p>}
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col items-start gap-[10px]">
                <div className="flex items-center gap-[12px]">
                  <span className={`${CELL} w-[120px]`}>{r.name}</span>
                  <span className={`${CELL} w-[70px] text-fg-secondary`}>{r.part}</span>
                  <span className={`${CELL} w-[80px]`}>{r.due}</span>
                  <span className={`${CELL} w-[80px] ${r.doneAt ? '' : 'text-fg-tertiary'}`}>{r.doneAt ?? '—'}</span>
                  <span className={`${CELL} w-[100px]`}>{r.size}</span>
                  <span className={`${CELL} w-[85px]`}>{r.qty}</span>
                  <span className="flex w-[85px] shrink-0"><StatusPill status={r.status} /></span>
                  <span className={`${CELL} w-[85px]`}>{r.owner}</span>
                  <span className={`${CELL} w-[84px]`}>{r.material}</span>
                  <span className={`${CELL} w-[140px]`}>{r.vendor}</span>
                  <span className={`${CELL} w-[180px]`}>{r.contact}</span>
                  <span className={`${CELL} w-[120px]`}>{r.note}</span>
                  {cp.props.map((p) => (
                    <PropCell key={p.id} prop={p} value={cp.getValue(r.id, p.id)} onChange={(v) => cp.setValue(r.id, p.id, v)} />
                  ))}
                  {design && (
                    <button
                      type="button"
                      aria-expanded={commentFor === r.id}
                      onClick={() => {
                        setCommentFor(commentFor === r.id ? null : r.id);
                        setComment('');
                      }}
                      className="flex h-[34px] shrink-0 items-center rounded-[7px] bg-brand px-[7px] text-base font-semibold text-fg-inverse"
                    >
                      의견 보내기
                    </button>
                  )}
                </div>
                {design && commentFor === r.id && (
                  <div className="flex w-full flex-col items-start gap-[10px]">
                    <textarea
                      autoFocus
                      aria-label="의견"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className={`h-[58px] w-full resize-none rounded-lg border-[0.5px] border-solid bg-surface p-[8px] text-base text-black outline-none focus:border-brand ${LINE}`}
                    />
                    <button type="button" onClick={send} className="rounded-lg bg-brand p-[6px] text-base font-semibold text-fg-inverse">
                      보내기
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FIELDS = ['name', 'size', 'qty', 'material', 'vendor', 'contact', 'note'] as const;
const WIDTHS = ['w-[120px]', 'w-[100px]', 'w-[85px]', 'w-[85px]', 'w-[140px]', 'w-[180px]', 'w-[120px]'];

const STATUS_LABEL: Record<RequestStatus, string> = { pending: '승인 대기', reject: '반려', success: '승인 완료', draft: '작성 중' };

/** 디자인 요청 목록을 CSV로 다운로드한다. 표에 보이는 컬럼 그대로 담는다. */
function downloadDesignRequests(eventName: string, rows: RequestRow[]) {
  const header = ['품명', '파트', '마감일', '사이즈', '수량', '재질', '발주업체', '업체 담당자(연락처)', '비고', '협의중', '상태'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.map(esc).join(','),
    ...rows.map((r) =>
      [r.name, r.part, r.due, r.size, r.qty, r.material, r.vendor, r.contact, r.note, r.negotiating ? '예' : '아니오', STATUS_LABEL[r.status]].map(esc).join(','),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `design-requests-${eventName.replace(/[\\/:*?"<>|\s]+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
export function DesignRequestTable({ team, part = '전체', eventName = '행사', eventId = 'default' }: { team: Team; part?: PartFilter; eventName?: string; eventId?: string }) {
  const cp = useCustomProps(`${eventId}:design-request`);
  const [rows, setRows] = useState(INITIAL_ROWS[team]);
  const planning = team === 'planning';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = matchPart(rows, part);
  const deletingRow = deletingId ? (rows.find((r) => r.id === deletingId) ?? null) : null;

  const update = (id: string, patch: Partial<RequestRow>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setRows((list) => list.filter((r) => r.id !== id));
  const duplicate = (r: RequestRow) =>
    setRows((list) => [...list, { ...r, id: `n${Date.now()}`, status: 'draft' }]);
  const add = () => setRows((list) => [...list, { ...row(`n${Date.now()}`, 'draft', ''), name: '', size: '', qty: '', material: '', contact: '' }]);

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
                      <input
                        key={f}
                        aria-label={f}
                        value={r[f]}
                        onChange={(e) => update(r.id, { [f]: e.target.value })}
                        className={`h-[40px] min-w-0 shrink-0 rounded-lg border-[0.5px] border-solid bg-surface px-[14px] text-[15px] text-fg outline-none focus:border-brand ${LINE} ${WIDTHS[fi]}`}
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
                  <input
                    type="checkbox"
                    aria-label="협의중"
                    checked={r.negotiating}
                    onChange={(e) => update(r.id, { negotiating: e.target.checked })}
                    className="size-[16px] accent-brand"
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
