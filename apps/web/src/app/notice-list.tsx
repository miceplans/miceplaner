'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getToken } from '../lib/api';
import { getNoticesListQueryKey, useEventsList, useGetMe, useNoticesCreate, useNoticesDismiss, useNoticesList, useNoticesRemove } from '../lib/api/generated/endpoints';
import type { EventListItemDto, NoticeDto } from '@miceplans/contracts';
import { toast } from '@miceplans/ui';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-11-23T09:05:21.332Z' → '2026.11.23 (월) 09:05' — 알림 화면과 같은 형식 */
function formatDate(at: string): string {
  const [date, clock] = at.replace(/\.\d{3}Z$/, '').replace('Z', '').split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}.${pad(m)}.${pad(d)} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]}) ${pad(hh)}:${pad(mm)}`;
}

const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

/** 내가 PM·AM으로 속한 행사. PM·AM 이름이 ', '로 묶여 오므로 이름으로 걸러낸다. */
function managedEventsOf(events: EventListItemDto[], meName: string | null): EventListItemDto[] {
  if (!meName) return [];
  return events.filter((e) => [e.pmName, e.amName].some((names) => (names ?? '').split(',').map((s) => s.trim()).includes(meName)));
}

function NoticeItem({ notice, onDismiss, onRemove }: { notice: NoticeDto; onDismiss?: () => void; onRemove?: () => void }) {
  return (
    <article className="flex w-full flex-col items-start gap-[6px] border-b border-solid border-border px-[10px] py-[16px] first:border-t hover:bg-surface-sunken">
      <div className="flex w-full items-center gap-[8px]">
        {notice.dismissedAt ? null : (
          <span className="flex h-[18px] items-center justify-center whitespace-nowrap rounded-sm bg-brand-tint px-[6px] text-2xs font-bold text-brand">고정</span>
        )}
        {notice.eventName ? (
          <span className="flex h-[18px] items-center justify-center whitespace-nowrap rounded-sm bg-surface-sunken px-[6px] text-2xs font-medium text-fg-secondary">{notice.eventName}</span>
        ) : null}
        <h3 className="m-0 whitespace-nowrap text-base font-semibold text-fg">{notice.title}</h3>
        <div className="h-px min-w-px flex-1" />
        <span className="whitespace-nowrap text-2xs text-fg-tertiary">{formatDate(notice.createdAt)}</span>
      </div>
      <p className="m-0 text-base text-fg-secondary">{notice.body}</p>
      <div className="flex w-full items-center gap-[10px]">
        <span className="whitespace-nowrap text-2xs text-fg-tertiary">{notice.authorName}</span>
        <div className="h-px min-w-px flex-1" />
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="whitespace-nowrap text-2xs font-medium text-fg-secondary underline">닫기</button>
        ) : null}
        {onRemove ? (
          <button type="button" onClick={onRemove} className="whitespace-nowrap text-2xs font-medium text-notice underline">삭제</button>
        ) : null}
      </div>
    </article>
  );
}

/**
 * 공지 목록 (명세 F-13). 관리자가 올리고, 받은 사람이 닫기 전까지 최상단에 고정된다.
 * 전체 공지는 Super Admin이, 행사 공지는 그 행사의 PM·AM(과 Super Admin)이 올린다.
 */
export function NoticeList() {
  const queryClient = useQueryClient();
  const me = useGetMe({ query: { enabled: getToken() !== null, staleTime: Infinity } });
  const events = useEventsList();
  // 웹은 소켓을 쓰지 않으므로 30초마다 다시 받는다.
  const notices = useNoticesList({ query: { refetchInterval: 30_000 } });

  const items = useMemo(() => notices.data ?? [], [notices.data]);
  const active = items.filter((n) => !n.dismissedAt);
  const dismissed = items.filter((n) => n.dismissedAt);

  const isSuperAdmin = me.data?.role === 'super_admin';
  const meName = me.data?.name ?? null;
  const managedEvents = useMemo(() => managedEventsOf(events.data ?? [], meName), [events.data, meName]);
  const writableEvents = isSuperAdmin ? (events.data ?? []) : managedEvents;
  const canWrite = writableEvents.length > 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getNoticesListQueryKey() });

  const [writing, setWriting] = useState(false);
  const [scope, setScope] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const createMutation = useNoticesCreate();
  const dismissMutation = useNoticesDismiss();
  const removeMutation = useNoticesRemove();

  const openForm = () => {
    setScope(isSuperAdmin ? '' : (managedEvents[0]?.id ?? ''));
    setWriting(true);
  };

  const submit = () => {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    createMutation.mutate(
      { data: { eventId: scope || null, title: title.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          toast.info('공지를 올렸습니다.');
          setWriting(false);
          setTitle('');
          setBody('');
          setScope('');
          void invalidate();
        },
        onError: (error) => fail(error, '[500] 공지를 올리지 못했습니다.'),
        onSettled: () => setBusy(false),
      },
    );
  };

  const dismiss = (notice: NoticeDto) => {
    dismissMutation.mutate(
      { id: notice.id },
      { onSuccess: () => void invalidate(), onError: (error) => fail(error, '[500] 공지를 닫지 못했습니다.') },
    );
  };

  const remove = (notice: NoticeDto) => {
    if (!window.confirm(`'${notice.title}' 공지를 삭제할까요?`)) return;
    removeMutation.mutate(
      { id: notice.id },
      {
        onSuccess: () => {
          toast.info('공지를 삭제했습니다.');
          void invalidate();
        },
        onError: (error) => fail(error, '[500] 공지를 삭제하지 못했습니다.'),
      },
    );
  };

  const canRemove = (notice: NoticeDto) => isSuperAdmin || notice.authorId === me.data?.id;

  return (
    <div className="flex w-full flex-col items-start px-[20px] max-md:px-0">
      {canWrite ? (
        <div className="flex w-full items-center justify-end px-[10px] py-[10px]">
          <button
            type="button"
            onClick={() => (writing ? setWriting(false) : openForm())}
            className="flex h-[32px] items-center gap-[6px] rounded-md bg-brand px-[12px] text-sm font-semibold text-fg-inverse hover:opacity-90"
          >
            <span className="text-base font-normal leading-none">+</span> 공지 올리기
          </button>
        </div>
      ) : null}
      {writing ? (
        <div className="flex w-full flex-col items-start gap-[10px] border-b border-solid border-border bg-surface-sunken px-[10px] py-[16px]">
          <div className="flex w-full items-center gap-[8px]">
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-[32px] rounded-md border border-solid border-border bg-surface px-[8px] text-sm text-fg">
              {isSuperAdmin ? <option value="">전체</option> : null}
              {writableEvents.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              maxLength={200}
              className="h-[32px] min-w-px flex-1 rounded-md border border-solid border-border bg-surface px-[10px] text-sm text-fg outline-none"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="내용"
            maxLength={5000}
            rows={4}
            className="w-full resize-y rounded-md border border-solid border-border bg-surface px-[10px] py-[8px] text-sm text-fg outline-none"
          />
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              disabled={busy || !title.trim() || !body.trim()}
              onClick={submit}
              className="flex h-[30px] items-center rounded-sm bg-brand px-[12px] text-xs font-semibold text-fg-inverse disabled:opacity-50"
            >
              {busy ? '올리는 중…' : '올리기'}
            </button>
            <button type="button" onClick={() => setWriting(false)} className="flex h-[30px] items-center rounded-sm border border-solid border-border bg-surface px-[12px] text-xs font-medium text-fg-secondary">
              취소
            </button>
          </div>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="w-full px-[10px] py-[24px] text-center text-sm text-fg-tertiary">등록된 공지가 없습니다.</p>
      ) : (
        <>
          {active.map((n) => (
            <NoticeItem key={n.id} notice={n} onDismiss={() => dismiss(n)} onRemove={canRemove(n) ? () => remove(n) : undefined} />
          ))}
          {dismissed.length > 0 ? (
            <>
              <div className="flex w-full items-center gap-[8px] px-[10px] pt-[20px] pb-[6px]">
                <span className="whitespace-nowrap text-sm font-semibold text-fg-secondary">이전 공지</span>
                <div className="h-px min-w-px flex-1" />
              </div>
              {dismissed.map((n) => (
                <NoticeItem key={n.id} notice={n} onRemove={canRemove(n) ? () => remove(n) : undefined} />
              ))}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
