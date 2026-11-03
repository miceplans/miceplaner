'use client';

import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ChatEvent, ProposalDto } from '@miceplans/contracts';
import { Input, toast } from '@miceplans/ui';
import { ApiError, decideProposal, streamChat } from '@/lib/api';

const A = '/assets/ai-chat';

const CHIPS = ['다음 주 일정', '지연된 Task 보여줘'];

type Source = Extract<ChatEvent, { type: 'sources' }>['sources'][number];
type Turn = { role: 'user' | 'assistant'; content: string; sources?: Source[]; proposals?: ProposalDto[] };

const KIND_LABEL: Record<ProposalDto['kind'], string> = { task_drafts: 'Task 초안', notification: '알림', wiki_edit: '위키 수정' };
const DECISION_LABEL: Record<ProposalDto['status'], string> = { pending: '승인 대기', approved: '승인됨', rejected: '반려됨' };

/** 행사 상세(`/events/:id`)에서는 그 행사를 대화의 기본 맥락으로 보낸다. */
const eventIdFrom = (pathname: string) => /^\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$)/i.exec(pathname)?.[1];

export function AiChatPanel({ onClose, className }: { onClose?: () => void; className?: string } = {}) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const pathname = usePathname();

  if (!open) return null;

  const patchLast = (fn: (t: Turn) => Turn) => setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? fn(t) : t)));

  const handle = (e: ChatEvent) => {
    if (e.type === 'text') patchLast((t) => ({ ...t, content: t.content + e.delta }));
    else if (e.type === 'sources') patchLast((t) => ({ ...t, sources: e.sources }));
    else if (e.type === 'proposal') patchLast((t) => ({ ...t, proposals: [...(t.proposals ?? []), e.proposal] }));
    else if (e.type === 'error') toast.error(e.message);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...turns, { role: 'user' as const, content }].filter((t) => t.content).map(({ role, content: c }) => ({ role, content: c }));
    setTurns((prev) => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }]);
    setDraft('');
    setBusy(true);
    abort.current = new AbortController();
    try {
      await streamChat({ eventId: eventIdFrom(pathname), messages: history.slice(-40) }, handle, abort.current.signal);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error(error instanceof ApiError ? error.message : '답변을 받지 못했다');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (turnIndex: number, proposal: ProposalDto, action: 'approve' | 'reject') => {
    try {
      const updated = await decideProposal(proposal.id, action);
      setTurns((prev) => prev.map((t, i) => (i === turnIndex ? { ...t, proposals: t.proposals?.map((p) => (p.id === updated.id ? updated : p)) } : t)));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '처리하지 못했다');
    }
  };

  return (
    <div
      className={className ?? 'absolute left-[1099.5px] top-[358px] flex leading-[normal] h-[524px] w-[323px] flex-col items-start overflow-clip rounded-md border-l-[0.834px] border-solid border-border bg-surface shadow-panel'}
      data-name="AI Chat Panel Overlay"
    >
      <div className="flex h-[46.69px] w-full shrink-0 items-center justify-between border-b-[0.834px] border-solid border-border px-[16.675px]">
        <div className="flex items-center gap-[4px]">
          <img alt="" src={`${A}/group15.svg`} className="block h-[19.995px] w-[17.659px] rotate-180" />
          <span className="whitespace-nowrap text-2xs font-semibold text-fg">Agent</span>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => {
            abort.current?.abort();
            if (onClose) onClose();
            else setOpen(false);
          }}
          className="flex size-[23.345px] items-center justify-center rounded-xs"
        >
          <img alt="" src={`${A}/close-icon.svg`} className="size-[13.34px]" />
        </button>
      </div>
      <div className="flex min-h-px w-full flex-1 flex-col items-start gap-[11.673px] overflow-y-auto bg-surface p-[13.34px]" aria-live="polite">
        {turns.length === 0 && <p className="text-2xs text-fg-secondary">행사 일정, 태스크, 위키 문서를 물어보세요. 변경은 제안만 만들고 PM·AM이 승인해야 반영됩니다.</p>}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="flex w-full items-start justify-end">
              <div className="flex items-center justify-center self-stretch rounded-bl-lg rounded-br-xs rounded-tl-lg rounded-tr-lg bg-brand px-[11.673px] py-[8.337px]">
                <span className="whitespace-pre-wrap text-2xs text-fg-inverse">{t.content}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex w-full flex-col items-start gap-[8.337px]">
              {t.content ? <p className="w-full whitespace-pre-wrap text-2xs leading-[1.5] text-fg">{t.content}</p> : busy && i === turns.length - 1 && <p className="text-2xs text-fg-secondary">생각하는 중…</p>}
              {t.sources && t.sources.length > 0 && (
                <div className="flex w-full flex-col gap-[4px] rounded-md border-[0.834px] border-solid border-border p-[8.337px]">
                  <span className="text-2xs font-semibold text-fg">출처</span>
                  {t.sources.map((s) => (
                    <a key={s.docId} href={`/wiki?doc=${s.docId}`} className="text-2xs text-fg-secondary underline">
                      {s.title}
                      {s.heading ? ` › ${s.heading}` : ''}
                    </a>
                  ))}
                </div>
              )}
              {t.proposals?.map((p) => (
                <div key={p.id} className="flex w-full flex-col gap-[6.67px] rounded-md border-[0.834px] border-solid border-border bg-surface p-[11.673px]">
                  <div className="flex items-center justify-between gap-[8px]">
                    <span className="text-2xs font-semibold text-fg">{KIND_LABEL[p.kind]} 제안</span>
                    <span className="text-2xs text-fg-secondary">{DECISION_LABEL[p.status]}</span>
                  </div>
                  <p className="text-2xs text-fg">{p.summary}</p>
                  {p.status === 'pending' && (
                    <div className="flex gap-[6.67px]">
                      <button type="button" onClick={() => decide(i, p, 'approve')} className="h-[23.345px] rounded-sm bg-brand px-[10px] text-2xs text-fg-inverse">
                        승인
                      </button>
                      <button type="button" onClick={() => decide(i, p, 'reject')} className="h-[23.345px] rounded-sm border-[0.834px] border-solid border-border px-[10px] text-2xs text-fg-secondary">
                        반려
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ),
        )}
        {turns.length === 0 && (
          <div className="flex items-start gap-[5.003px] py-[21.677px]">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft(c)}
                className="flex h-[23.345px] items-center justify-center rounded-lg border-[0.834px] border-solid border-border bg-surface px-[8.337px] text-2xs text-fg-secondary"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <form
        className="flex h-[53.36px] w-full shrink-0 items-center gap-[6.67px] border-t-[0.834px] border-solid border-border bg-surface px-[10.005px]"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <Input
          variant="chip"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="무엇이든 물어보세요"
          maxLength={8000}
          className="h-[33.35px] flex-1"
        />
        <button type="submit" aria-label="보내기" disabled={busy || !draft.trim()} className="flex size-[30.015px] items-center justify-center rounded-sm bg-brand disabled:opacity-50">
          <img alt="" src={`${A}/send-icon.svg`} className="size-[13.34px]" />
        </button>
      </form>
    </div>
  );
}
