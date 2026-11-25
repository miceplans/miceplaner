'use client';

import { useRef, useState } from 'react';
import type { ChatEvent, ProposalDto } from '@miceplans/contracts';
import { Input, toast, usePersisted } from '@miceplans/ui';
import { ApiError, streamChat } from '@/lib/api';
import { useApproveProposal, useRejectProposal } from '@/lib/api/generated/endpoints';
import { toChatMessages } from './chat-history';
import { commitTurns, getTurns, patchTurn, turnsStore } from './chat-store';
import { eventIdFrom, getEventItems, getEventTab } from './event-context';

const A = '/assets/ai-chat';

const CHIPS = ['다음 주 일정', '지연된 Task 보여줘'];
const KIND_LABEL: Record<ProposalDto['kind'], string> = { task_drafts: 'Task 초안', notification: '알림', wiki_edit: '위키 수정' };
const DECISION_LABEL: Record<ProposalDto['status'], string> = { pending: '승인 대기', approved: '승인됨', rejected: '반려됨' };

export function AiChatPanel({ onClose, className }: { onClose?: () => void; className?: string } = {}) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const [turns] = usePersisted(turnsStore);
  const [busy, setBusy] = useState(false);
  /** 답변 글자가 오기 전 대기 안내. 대화 기록에는 저장하지 않는다. */
  const [status, setStatus] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const approve = useApproveProposal();
  const reject = useRejectProposal();

  if (!open) return null;

  /** 토스트는 금방 사라지므로 답변 자리에도 이유를 남긴다. */
  const fail = (index: number, message: string) => {
    toast.error(message);
    patchTurn(index, (t) => ({ ...t, error: message }));
  };

  const handle = (index: number, e: ChatEvent) => {
    if (e.type === 'status') setStatus(e.message);
    else if (e.type === 'text') {
      setStatus(null);
      patchTurn(index, (t) => ({ ...t, content: t.content + e.delta }));
    } else if (e.type === 'sources') patchTurn(index, (t) => ({ ...t, sources: e.sources }));
    else if (e.type === 'proposal') patchTurn(index, (t) => ({ ...t, proposals: [...(t.proposals ?? []), e.proposal] }));
    else if (e.type === 'error') fail(index, e.message);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy || sending.current) return;
    sending.current = true;
    const before = getTurns();
    const history = toChatMessages([...before, { role: 'user', content }]);
    // 답변이 들어갈 자리. 대화는 뒤에만 붙으므로 자리가 바뀌지 않는다.
    const index = before.length + 1;
    commitTurns([...before, { role: 'user', content }, { role: 'assistant', content: '' }]);
    setDraft('');
    setBusy(true);
    abort.current = new AbortController();
    try {
      const eventId = eventIdFrom(window.location.pathname, window.location.search);
      const eventTab = eventId ? getEventTab() : undefined;
      const eventItems = eventId ? getEventItems() : undefined;
      await streamChat({ eventId, eventTab, eventItems, messages: history }, (e) => handle(index, e), abort.current.signal);
      const last = getTurns()[index];
      if (last && !last.content.trim() && !last.error && !last.proposals?.length) fail(index, '[500] 답변을 받지 못했습니다. 다시 질문해 주세요.');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) fail(index, error instanceof ApiError ? error.message : '[500] 답변을 받지 못했습니다.');
    } finally {
      sending.current = false;
      setStatus(null);
      setBusy(false);
    }
  };

  const decide = async (turnIndex: number, proposal: ProposalDto, action: 'approve' | 'reject') => {
    try {
      const updated = await (action === 'approve' ? approve : reject).mutateAsync({ id: proposal.id });
      commitTurns(getTurns().map((t, i) => (i === turnIndex ? { ...t, proposals: t.proposals?.map((p) => (p.id === updated.id ? updated : p)) } : t)));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : '[500] 처리하지 못했습니다.');
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
          <span className="whitespace-nowrap text-2xs font-semibold text-fg">에이전트</span>
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
              {t.content.trim() ? <p className="w-full whitespace-pre-wrap text-2xs leading-[1.5] text-fg">{t.content}</p> : busy && !t.error && i === turns.length - 1 && <p className="text-2xs text-fg-secondary">{status ?? '생각하는 중…'}</p>}
              {t.error && <p className="w-full text-2xs leading-[1.5] text-error">{t.error}</p>}
              {t.content.trim() && status && busy && i === turns.length - 1 && <p className="text-2xs text-fg-secondary">{status}</p>}
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
