'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog, Select } from '@miceplans/ui';

import { matchPart, type PartFilter } from './event-parts';
import { DEFAULT_VISIBILITY, VISIBILITIES, relTime, type DocVisibility } from './event-docs-model';
import { useCollab } from './use-event-docs-collab';
import { Avatar, VisibilityChip } from './event-docs-ui';
import { DocPanel } from './event-docs-panel';

/** canManage: PM·AM만 문서 열람 범위를 바꿀 수 있다 (docs/functional-specification.md 위키 수용 기준). */
export function EventDocs({ eventId, part = '전체', canManage = false }: { eventId: string; part?: PartFilter; canManage?: boolean }) {
  const collab = useCollab(eventId);
  const { docs, peers } = collab;
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // 열람 인원 설정은 컴포넌트 state만 유지한다. 서버 연동 시 문서 메타로 옮긴다.
  const [visibilityByDoc, setVisibilityByDoc] = useState<Record<string, DocVisibility>>({});
  const visibilityKey = `miceplans.docs.visibility.${eventId}`;

  // 새로고침 후에도 유지: hydration 이후 저장값을 복원하고, 알 수 없는 값은 버린다.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(visibilityKey);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        const next: Record<string, DocVisibility> = {};
        for (const [id, v] of Object.entries(parsed)) {
          if ((VISIBILITIES as readonly string[]).includes(v as string)) next[id] = v as DocVisibility;
        }
        setVisibilityByDoc(next);
      }
    } catch {
      // 저장값을 읽을 수 없으면 기본 공개 범위를 쓴다.
    }
    setRestored(true);
  }, [visibilityKey]);

  const changeVisibility = (docId: string, value: DocVisibility) =>
    setVisibilityByDoc((prev) => {
      const next = { ...prev, [docId]: value };
      try {
        window.localStorage.setItem(visibilityKey, JSON.stringify(next));
      } catch {
        // localStorage를 쓸 수 없는 환경에서는 세션 동안만 반영한다.
      }
      return next;
    });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const openDoc = docs.find((d) => d.id === openId) ?? null;
  const visibleDocs = matchPart(
    docs.filter((d) => !d.deletedTs),
    part,
  );
  const deletingDoc = deletingId ? (docs.find((d) => d.id === deletingId) ?? null) : null;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex w-full flex-col gap-[8px] py-[12px]">
      <ul className="m-0 flex w-full list-none flex-col p-0">
        {visibleDocs.map((d) => {
          const viewers = peers.filter((p) => p.docId === d.id);
          const visibility = visibilityByDoc[d.id] ?? DEFAULT_VISIBILITY;
          return (
            <li key={d.id} className="flex h-[44px] items-center gap-[10px] rounded-md px-[8px] hover:bg-surface-sunken">
              <button type="button" onClick={() => setOpenId(d.id)} className="flex min-w-0 flex-1 items-center gap-[10px] text-left">
                <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-fg-tertiary"><path d="M4 1.75h5.5L12.5 4.75V14.25H4V1.75Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M6 8h4.5M6 10.5h4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                <span className="truncate text-base font-medium text-fg">{d.title || '제목 없음'}</span>
                {d.part && <span className="shrink-0 rounded-md bg-surface-chip px-[6px] py-px text-2xs font-semibold text-fg-secondary">{d.part}</span>}
              </button>
              {/* 저장값 복원 전에는 기본값이 잠깐 비치지 않도록 자리만 유지한다. */}
              <span className={restored ? '' : 'invisible'}>
                <VisibilityChip value={visibility} />
              </span>
              <Select
                size="sm"
                aria-label="열람 인원 설정"
                value={visibility}
                disabled={!canManage}
                title={canManage ? undefined : 'PM·AM만 열람 범위를 바꿀 수 있습니다'}
                onChange={(e) => changeVisibility(d.id, e.target.value as DocVisibility)}
                options={VISIBILITIES.map((v) => ({ value: v, label: v }))}
                className={`shrink-0 text-fg-secondary disabled:cursor-not-allowed disabled:opacity-60 ${restored ? '' : 'invisible'}`}
              />
              {viewers.length > 0 && (
                <span className="flex shrink-0 items-center" aria-label={`${viewers.map((v) => v.name).join(', ')} 편집 중`}>
                  {viewers.map((v, i) => (
                    <span key={v.clientId} style={{ marginLeft: i ? -6 : 0 }}><Avatar name={v.name} color={v.color} size={20} /></span>
                  ))}
                </span>
              )}
              <span className="w-[72px] shrink-0 text-right text-sm text-fg-tertiary">{relTime(d.updatedTs, now)}</span>
              <button
                type="button"
                aria-label={`${d.title || '제목 없음'} 문서 삭제`}
                onClick={() => setDeletingId(d.id)}
                className="flex size-[24px] shrink-0 items-center justify-center rounded-md text-fg-tertiary hover:bg-surface-chip"
              >
                ×
              </button>
            </li>
          );
        })}
        {!visibleDocs.length && <li className="px-[8px] py-[12px] text-base text-fg-tertiary">해당 파트의 문서가 없습니다.</li>}
      </ul>
      <button
        type="button"
        onClick={() => { const id = collab.createDoc(); if (id) setOpenId(id); }}
        className="flex h-[36px] items-center gap-[10px] pl-[8px] text-base text-fg-tertiary hover:text-fg-secondary"
      >
        <span className="flex size-[14px] items-center justify-center">+</span>
        새 문서
      </button>

      {openDoc && <DocPanel key={openDoc.id} doc={openDoc} collab={collab} visibility={visibilityByDoc[openDoc.id] ?? DEFAULT_VISIBILITY} onClose={() => setOpenId(null)} />}

      {deletingDoc && (
        <ConfirmDialog
          title={`'${deletingDoc.title || '제목 없음'}' 문서를 삭제할까요?`}
          body="문서 안의 모든 블록이 함께 삭제되며 복구할 수 없습니다."
          onClose={() => setDeletingId(null)}
          onConfirm={() => {
            collab.deleteDoc(deletingDoc.id);
            if (openId === deletingDoc.id) setOpenId(null);
            setDeletingId(null);
          }}
        />
      )}
    </div>
  );
}
