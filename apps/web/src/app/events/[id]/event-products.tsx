'use client';

import { useState, type ReactNode } from 'react';

const A = '/assets/event-detail';

export type Team = 'planning' | 'design';

type RequestStatus = 'pending' | 'reject' | 'success' | 'draft';

type RequestRow = {
  id: string;
  name: string;
  size: string;
  qty: string;
  material: string;
  vendor: string;
  contact: string;
  note: string;
  negotiating: boolean;
  status: RequestStatus;
};

const row = (id: string, status: RequestStatus, vendor = '스피드'): RequestRow => ({
  id,
  name: '명찰',
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
  planning: [row('r1', 'reject'), row('r2', 'reject'), row('r3', 'draft')],
  design: [row('r1', 'pending'), row('r2', 'reject'), row('r3', 'success')],
};

const HEAD = 'bg-[#edf1f7]';
const LINE = 'border-[#e6e6ea]';
const CELL = 'flex h-[40px] shrink-0 items-center rounded-lg px-[8px] text-[15px] text-[#101010]';

function Required() {
  return <span className="text-brand">*</span>;
}

function Pill({ tone, label, icon }: { tone: 'progress' | 'reject' | 'success'; label: string; icon: string }) {
  const style = {
    progress: 'bg-info-bg text-info',
    reject: 'bg-[#ffe4f0] text-[#f53488]',
    success: 'bg-success-bg text-success',
  }[tone];
  return (
    <span className={`flex h-[24px] shrink-0 items-center gap-[4px] rounded-md px-[8px] text-xs font-bold ${style}`}>
      <img alt="" src={`${A}/${icon}.svg`} className="size-[14px]" />
      {label}
    </span>
  );
}

function TableTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[16px] font-semibold text-black">{children}</h2>;
}

/** 진행상황: 행사 전체 제작물의 현재 상태를 읽기 전용으로 보여준다. */
export function ProgressTable() {
  return (
    <section className="flex w-full flex-col gap-[12px]">
      <TableTitle>진행상황</TableTitle>
      <div className="overflow-x-auto">
        <div className="flex min-w-[1020px] flex-col">
          <div className={`flex items-center gap-[12px] rounded-t-lg px-[14px] py-[8px] ${HEAD}`}>
            <span className={`${CELL} w-[120px]`}>품명</span>
            <span className={`${CELL} w-[100px]`}>사이즈 <Required /></span>
            <span className={`${CELL} w-[85px]`}>수량</span>
            <span className={`${CELL} w-[85px]`}>상태</span>
            <span className={`${CELL} w-[85px]`}>담당자</span>
            <span className={`${CELL} w-[84px]`}>재질 <Required /></span>
            <span className={`${CELL} w-[140px]`}>발주업체</span>
            <span className={`${CELL} w-[180px]`}>업체 담당자(연락처)</span>
            <span className={`${CELL} w-[120px]`}>비고</span>
          </div>
          <div className={`flex items-center gap-[12px] rounded-b-lg border border-solid bg-surface px-[14px] py-[10px] ${LINE}`}>
            <span className={`${CELL} w-[120px]`}>명찰</span>
            <span className={`${CELL} w-[100px]`}>400×300</span>
            <span className={`${CELL} w-[85px]`}>3개</span>
            <span className="flex w-[85px] shrink-0"><Pill tone="progress" label="진행중" icon="pill-progress" /></span>
            <span className={`${CELL} w-[85px]`}>김민수</span>
            <span className={`${CELL} w-[84px]`}>거칠거칠</span>
            <span className={`${CELL} w-[140px]`}>거칠거칠</span>
            <span className={`${CELL} w-[180px]`}>055-0203-0211</span>
            <span className="h-[40px] w-[120px] shrink-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

const FIELDS = ['name', 'size', 'qty', 'material', 'vendor', 'contact', 'note'] as const;
const WIDTHS = ['w-[120px]', 'w-[100px]', 'w-[85px]', 'w-[85px]', 'w-[140px]', 'w-[180px]', 'w-[120px]'];

/** 디자인 요청 표의 더보기 메뉴. 업로드·다운로드는 파일 기능 구현 전까지 메뉴만 닫는다. */
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
              className="flex items-center gap-[4px] whitespace-nowrap rounded-lg p-[8px] text-left text-[15px] text-[#6e7589] hover:bg-surface-subtle"
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
export function DesignRequestTable({ team }: { team: Team }) {
  const [rows, setRows] = useState(INITIAL_ROWS[team]);
  const planning = team === 'planning';

  const update = (id: string, patch: Partial<RequestRow>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setRows((list) => list.filter((r) => r.id !== id));
  const duplicate = (r: RequestRow) =>
    setRows((list) => [...list, { ...r, id: `n${Date.now()}`, status: 'draft' }]);
  const add = () => setRows((list) => [...list, { ...row(`n${Date.now()}`, 'draft', ''), name: '', size: '', qty: '', material: '', contact: '' }]);

  return (
    <section className="flex w-full flex-col gap-[12px]">
      <TableTitle>디자인 요청</TableTitle>
      {planning && (
        <div className="flex items-center justify-end gap-[12px]">
          <MoreMenu />
          <button type="button" onClick={add} className="flex items-center gap-[4px] rounded-lg bg-brand p-[8px] text-[15px] text-fg-inverse">
            <img alt="" src={`${A}/add.svg`} className="size-[18px]" />
            새 항목 추가
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="flex min-w-[1020px] flex-col">
          <div className={`flex items-center gap-[12px] rounded-t-lg px-[14px] py-[8px] ${HEAD}`}>
            <span className={`${CELL} w-[120px]`}>품명</span>
            <span className={`${CELL} w-[100px]`}>사이즈 <Required /></span>
            <span className={`${CELL} w-[85px]`}>수량</span>
            <span className={`${CELL} w-[85px]`}>재질 <Required /></span>
            <span className={`${CELL} w-[140px]`}>발주업체</span>
            <span className={`${CELL} w-[180px]`}>업체 담당자(연락처)</span>
            <span className={`${CELL} w-[120px]`}>비고</span>
            <span className={`${CELL} w-[80px]`}>협의중</span>
            <span className={`${CELL} w-[84px]`}>{planning ? '상태/기능' : '승인'}</span>
          </div>
          {rows.map((r, i) => {
            const editing = r.status === 'draft';
            return (
              <div
                key={r.id}
                className={`flex items-center gap-[12px] border-0 border-x border-b border-solid bg-surface px-[14px] py-[10px] ${LINE} ${i === rows.length - 1 ? 'rounded-b-lg' : ''}`}
              >
                {FIELDS.map((f, fi) =>
                  editing ? (
                    <input
                      key={f}
                      aria-label={f}
                      value={r[f]}
                      onChange={(e) => update(r.id, { [f]: e.target.value })}
                      className={`h-[40px] min-w-0 shrink-0 rounded-lg border-[0.5px] border-solid bg-surface px-[14px] text-[15px] text-[#101010] outline-none focus:border-brand ${LINE} ${WIDTHS[fi]}`}
                    />
                  ) : (
                    <span key={f} className={`${CELL} ${WIDTHS[fi]} ${fi === 0 ? 'justify-between pr-[14px]' : ''}`}>
                      {r[f]}
                      {fi === 0 && <img alt="" src={`${A}/role-chevron.svg`} className="size-[14px]" />}
                    </span>
                  ),
                )}
                <span className="flex h-[40px] w-[80px] shrink-0 items-center px-[8px]">
                  <input
                    type="checkbox"
                    aria-label="협의중"
                    checked={r.negotiating}
                    onChange={(e) => update(r.id, { negotiating: e.target.checked })}
                    className="size-[16px] accent-brand"
                  />
                </span>
                <span className="flex shrink-0 items-center gap-[5.5px]">
                  {r.status === 'reject' && <Pill tone="reject" label="반려" icon="pill-reject" />}
                  {r.status === 'success' && <Pill tone="success" label="성공" icon="pill-success" />}
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
                  {editing && (
                    <>
                      <button type="button" aria-label="행 복제" onClick={() => duplicate(r)}>
                        <img alt="" src={`${A}/row-copy.svg`} className="size-[22px]" />
                      </button>
                      <button type="button" aria-label="행 삭제" onClick={() => remove(r.id)}>
                        <img alt="" src={`${A}/row-delete.svg`} className="size-[22px]" />
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
