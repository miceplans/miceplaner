'use client';

import { useState } from 'react';

const A = '/assets/ai-chat';

const CHIPS = ['다음 주 일정', '지연된 Task 보여줘'];

export function AiChatPanel({ onClose, className }: { onClose?: () => void; className?: string } = {}) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');

  if (!open) return null;

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
          onClick={() => onClose ? onClose() : setOpen(false)}
          className="flex size-[23.345px] items-center justify-center rounded-xs"
        >
          <img alt="" src={`${A}/close-icon.svg`} className="size-[13.34px]" />
        </button>
      </div>
      <div className="flex min-h-px w-full flex-1 flex-col items-start gap-[11.673px] overflow-y-auto bg-surface p-[13.34px]">
        <p className="text-2xs text-fg-secondary">예시 화면 · AI 답변 기능 준비 중</p>
        <div className="flex w-full items-start justify-end">
          <div className="flex items-center justify-center self-stretch rounded-bl-lg rounded-br-xs rounded-tl-lg rounded-tr-lg bg-brand px-[11.673px] py-[8.337px]">
            <span className="whitespace-nowrap text-center text-2xs text-fg-inverse">이번 주 행사 뭐 있어?</span>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-[8.337px]">
          <p className="w-full text-2xs leading-[1.5] text-fg">
            이번 주(3/6 – 3/12)에는 개막 행사는 없고, 3/13 시작하는 KIMES 2025 직전 준비 일정이 몰려 있어요.
          </p>
          <div className="flex h-[126.73px] w-full shrink-0 flex-col items-start gap-[6.67px] rounded-md border-[0.834px] border-solid border-border bg-surface p-[11.673px]">
            <div className="flex items-center gap-[8px]">
              <span className="whitespace-nowrap text-2xs font-semibold text-fg">제54회 KIMES 2025</span>
              <div className="flex h-[18.343px] items-center gap-[4.169px] rounded-md bg-info-bg px-[7.504px]">
                <img alt="" src={`${A}/dot.svg`} className="size-[5.003px]" />
                <span className="whitespace-nowrap text-2xs font-medium text-brand-blue">진행중</span>
              </div>
            </div>
            <div className="flex items-center gap-[5.003px]">
              <img alt="" src={`${A}/cal-icon.svg`} className="size-[10.839px]" />
              <span className="whitespace-nowrap text-2xs text-fg-secondary">03.13 – 03.16 · 코엑스 Hall A·B</span>
            </div>
            <div className="flex items-center gap-[5.003px]">
              <img alt="" src={`${A}/list-icon.svg`} className="size-[10.839px]" />
              <span className="whitespace-nowrap text-2xs text-fg-secondary">리허설 3.12 · 브로슈어 인쇄 3.6 – 3.10</span>
            </div>
            <a href="/dashboard" className="flex items-center gap-[3.335px] py-[3.335px]">
              <span className="whitespace-nowrap text-2xs font-medium text-brand">행사에서 열기</span>
              <img alt="" src={`${A}/arrow-icon.svg`} className="size-[10.005px]" />
            </a>
          </div>
          <div className="flex w-full items-center gap-[5.836px] rounded-sm bg-notice-bg px-[9.171px] py-[7.504px]">
            <img alt="" src={`${A}/warn-icon.svg`} className="size-[10.839px]" />
            <p className="min-w-px flex-1 text-2xs text-notice">브로슈어 인쇄가 2일 지연됐어요. 담당자에게 알림을 보낼까요?</p>
          </div>
        </div>
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
      </div>
      <form
        className="flex h-[53.36px] w-full shrink-0 items-center gap-[6.67px] border-t-[0.834px] border-solid border-border bg-surface px-[10.005px]"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="무엇이든 물어보세요"
          className="h-[33.35px] min-w-px flex-1 rounded-sm bg-surface-sunken px-[10.005px] text-2xs text-fg outline-none placeholder:text-fg-tertiary"
        />
        <button type="submit" aria-label="보내기 (준비 중)" disabled className="flex size-[30.015px] items-center justify-center rounded-sm bg-brand opacity-50">
          <img alt="" src={`${A}/send-icon.svg`} className="size-[13.34px]" />
        </button>
      </form>
    </div>
  );
}
