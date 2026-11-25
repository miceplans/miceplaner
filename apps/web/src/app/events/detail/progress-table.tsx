'use client';

import { useState } from 'react';
import { Select, StatusPill, Textarea, toast } from '@miceplans/ui';
import { createPersistedStore, scopedStores } from '@miceplans/ui/persisted-store';
import { AddPropertyButton, PROP_COL_WIDTH, PropCell, PropHeaderCell, useCustomProps } from './custom-props';
import { matchPart, type PartFilter } from './event-parts';
import {
  CELL,
  HEAD,
  LINE,
  SORT_OPTIONS,
  progressCommentKey,
  sortProgress,
  toProgressRow,
  type ProgressSort,
  type RequestRow,
  type Team,
} from './event-products-model';
import { Required, TableTitle } from './product-table-ui';

/** 행사별로 보낸 의견. 행 id가 키다. */
const commentStoreOf = scopedStores((eventId) =>
  createPersistedStore<Record<string, unknown>>({
    key: progressCommentKey(eventId),
    fallback: {},
    decode: (raw) => (raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}),
  }),
);

/** 진행상황: 행사 전체 제작물의 현재 상태를 보여준다. 디자인팀은 행마다 의견을 보낼 수 있다. */
export function ProgressTable({ team, part = '전체', eventId = 'default', rows: requestRows = [] }: { team: Team; part?: PartFilter; eventId?: string; rows?: RequestRow[] }) {
  const design = team === 'design';
  const cp = useCustomProps(`${eventId}:progress`);
  const [sort, setSort] = useState<ProgressSort>('완료일순');
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const rows = sortProgress(matchPart(requestRows.map(toProgressRow), part), sort);

  // TODO: 의견 전송 API·데이터 모델이 확정되면 서버에 보낸다. 지금은 행별로 로컬에 저장해 화면이 잃어버리지 않게 한다.
  const send = () => {
    const text = comment.trim();
    if (!text || !commentFor) return;
    commentStoreOf(eventId).set((prev) => ({ ...prev, [commentFor]: { text, at: new Date().toISOString() } }));
    toast.info('의견을 보냈습니다.');
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
          <Select
            aria-label="정렬 기준"
            value={sort}
            onChange={(e) => setSort(e.target.value as ProgressSort)}
            size="sm"
            className="shrink-0"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
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
                    <Textarea
                      autoFocus
                      aria-label="의견"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      size="lg"
                      className="h-[58px] w-full"
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
