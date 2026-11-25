'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, Input } from '@miceplans/ui';
import { ApiError, getToken } from '../lib/api';
import { useEventsList, useKnowledgeSearch } from '../lib/api/generated/endpoints';
import { searchEvents } from './search-events';

/** 입력이 멈춘 뒤에만 문서 검색 API를 부른다. */
const SEARCH_DELAY = 300;
const ROW = 'flex w-full flex-col gap-[2px] rounded-md px-[10px] py-[8px] text-left no-underline hover:bg-surface-chip focus-visible:bg-surface-chip';

/** 통합 검색 창 (명세 F-10). 행사는 받아 둔 목록에서, 문서는 권한 필터가 적용된 GET /search에서 찾는다. */
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const typed = query.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(typed), SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [typed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loggedIn = getToken() !== null;
  const events = useEventsList(undefined, { query: { enabled: loggedIn } });
  const docs = useKnowledgeSearch({ q: term, limit: 10 }, { query: { enabled: loggedIn && term !== '' } });
  const eventHits = useMemo(() => searchEvents(events.data ?? [], typed), [events.data, typed]);
  // 입력 중에는 이전 검색어의 문서 결과를 보여 주지 않는다.
  const docsReady = term === typed && docs.isSuccess;
  const docHits = docsReady ? docs.data : [];
  const docsFailed = term === typed && docs.isError;
  const loading = (events.isPending && !events.isError) || (!docsReady && !docsFailed);
  const errors = [
    events.isError ? (events.error instanceof ApiError ? events.error.message : '[500] 행사를 불러오지 못했습니다.') : null,
    docsFailed ? (docs.error instanceof ApiError ? docs.error.message : '[500] 문서를 검색하지 못했습니다.') : null,
  ].filter((m): m is string => m !== null);

  return (
    <Dialog onClose={onClose}>
      <div
        role="dialog"
        aria-label="통합 검색"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(560px,calc(100dvh-64px))] w-[560px] max-w-full flex-col rounded-lg bg-surface leading-[normal] shadow-card"
      >
        <form
          role="search"
          className="flex shrink-0 items-center gap-[10px] border-b border-solid border-border px-[16px] py-[12px]"
          onSubmit={(e) => {
            e.preventDefault();
            // Enter는 첫 결과로 이동한다.
            e.currentTarget.parentElement?.querySelector<HTMLAnchorElement>('a[data-hit]')?.click();
          }}
        >
          <img alt="" src="/assets/flow/search-icon.svg" className="size-[15px] shrink-0" />
          <Input
            autoFocus
            variant="ghost"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={200}
            placeholder="행사, 고객사, 문서 검색"
            aria-label="검색어"
            className="min-w-0 flex-1 text-base"
          />
          <button type="button" aria-label="검색 닫기" onClick={onClose} className="text-xs text-fg-tertiary hover:text-fg">
            ×
          </button>
        </form>
        <div className="flex min-h-[80px] flex-col gap-[12px] overflow-y-auto p-[10px]" aria-live="polite">
          {!typed && <p className="m-0 px-[10px] py-[8px] text-sm text-fg-tertiary">행사명·고객사·장소·담당자와 위키·자료 파일 내용을 검색합니다.</p>}
          {eventHits.length > 0 && (
            <section className="flex flex-col">
              <h3 className="m-0 px-[10px] py-[4px] text-2xs font-semibold text-fg-tertiary">행사</h3>
              {eventHits.map((e) => (
                <a key={e.id} data-hit href={`/events/detail?id=${e.id}`} className={ROW}>
                  <span className="truncate text-base font-medium text-fg">{e.name}</span>
                  <span className="truncate text-xs text-fg-secondary">
                    {[e.startDate === e.endDate ? e.startDate : `${e.startDate} – ${e.endDate}`, e.clientName, e.place].filter(Boolean).join(' · ')}
                  </span>
                </a>
              ))}
            </section>
          )}
          {docHits.length > 0 && (
            <section className="flex flex-col">
              <h3 className="m-0 px-[10px] py-[4px] text-2xs font-semibold text-fg-tertiary">문서</h3>
              {docHits.map((d) => (
                <a key={d.chunkId} data-hit href={`/wiki?doc=${d.docId}`} className={ROW}>
                  <span className="truncate text-base font-medium text-fg">
                    {d.title}
                    {d.heading ? ` › ${d.heading}` : ''}
                  </span>
                  <span className="line-clamp-2 text-xs text-fg-secondary">{d.snippet}</span>
                </a>
              ))}
            </section>
          )}
          {typed && errors.map((m) => <p key={m} role="alert" className="m-0 px-[10px] text-sm text-error">{m}</p>)}
          {typed && loading && <p className="m-0 px-[10px] py-[4px] text-sm text-fg-tertiary">검색 중…</p>}
          {typed && !loading && !errors.length && !eventHits.length && !docHits.length && <p className="m-0 px-[10px] py-[8px] text-sm text-fg-tertiary">검색 결과가 없습니다.</p>}
        </div>
      </div>
    </Dialog>
  );
}
