'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Checkbox, ConfirmDialog, Input, Textarea } from '@miceplans/ui';
import { BLOCK_MENU, relTime, visibleBlocks, type Block, type BlockType, type Doc, type DocVisibility } from './event-docs-model';
import type { Collab } from './use-event-docs-collab';
import { Avatar, VisibilityChip } from './event-docs-ui';

function BlockInput({
  block,
  inputRef,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
}: {
  block: Block;
  inputRef: (el: HTMLTextAreaElement | null) => void;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text, block.type]);

  const style =
    block.type === 'h1' ? 'text-2xl font-bold leading-[1.3]' : block.type === 'h2' ? 'text-lg font-semibold leading-[1.45]' : 'text-md leading-[1.6]';

  return (
    <Textarea
      ref={(el) => { ref.current = el; inputRef(el); }}
      rows={1}
      value={block.text}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ''))}
      onKeyDown={onKeyDown}
      variant="ghost"
      className={`block min-w-0 flex-1 overflow-hidden ${style} ${
        block.type === 'todo' && block.checked ? 'text-fg-tertiary! line-through' : ''
      }`}
    />
  );
}

export function DocPanel({
  doc,
  collab,
  visibility,
  onClose,
}: {
  doc: Doc;
  collab: Collab;
  visibility: DocVisibility;
  onClose: () => void;
}) {
  const { me, peers } = collab;
  const refs = useRef(new Map<string, HTMLTextAreaElement | null>());
  const pendingFocus = useRef<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const blocks = visibleBlocks(doc);
  const here = peers.filter((p) => p.docId === doc.id);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    collab.setLocation(doc.id, null);
    return () => collab.setLocation(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, me?.clientId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (pendingFocus.current) {
      const el = refs.current.get(pendingFocus.current);
      if (el) { el.focus(); pendingFocus.current = null; }
    }
  });

  const apply = (block: Block, type: BlockType) => {
    collab.editBlock(doc.id, block.id, { type, text: '', checked: type === 'todo' ? false : undefined });
    setMenuFor(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (menuFor === block.id) {
        const q = block.text.slice(1).toLowerCase();
        const match = BLOCK_MENU.find((m) => !q || m.label.includes(q) || m.type.startsWith(q));
        if (match) apply(block, match.type);
        return;
      }
      // 빈 목록 항목에서 Enter 하면 일반 문단으로 돌아간다.
      if ((block.type === 'todo' || block.type === 'bullet') && !block.text) {
        collab.editBlock(doc.id, block.id, { type: 'p', checked: undefined });
        return;
      }
      const keep = block.type === 'todo' || block.type === 'bullet';
      pendingFocus.current = collab.insertAfter(doc.id, block.id, { type: keep ? block.type : 'p', text: '', checked: block.type === 'todo' ? false : undefined });
    } else if (e.key === 'Backspace' && !block.text && blocks.length > 1) {
      e.preventDefault();
      pendingFocus.current = (blocks[index - 1] ?? blocks[index + 1]).id;
      collab.removeBlock(doc.id, block.id);
    } else if (e.key === 'ArrowUp' && index > 0 && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      refs.current.get(blocks[index - 1].id)?.focus();
    } else if (e.key === 'ArrowDown' && index < blocks.length - 1 && e.currentTarget.selectionStart === block.text.length) {
      e.preventDefault();
      refs.current.get(blocks[index + 1].id)?.focus();
    } else if (e.key === 'Escape' && menuFor) {
      e.stopPropagation();
      setMenuFor(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-transparent" onClick={onClose} aria-hidden />
      <aside aria-label="문서" className="side-peek-in fixed right-[24px] top-[96px] z-40 flex h-[694px] max-h-[calc(100vh-112px)] w-[560px] max-w-full flex-col rounded-2xl bg-surface shadow-card">
        <div className="flex items-center gap-[10px] border-0 border-b border-solid border-border-soft px-[28px] py-[14px]">
          <div className="flex items-center" aria-label="현재 접속자">
            {me && <Avatar name={me.name} color={me.color} />}
            {here.map((p) => (
              <span key={p.clientId} style={{ marginLeft: -6 }}><Avatar name={p.name} color={p.color} /></span>
            ))}
          </div>
          <span className="text-xs text-fg-secondary" role="status">
            {here.length ? `${here.map((p) => p.name).join(', ')} 님과 함께 편집 중` : '나만 보고 있어요'}
          </span>
          <VisibilityChip value={visibility} />
          <span className="flex-1" />
          <span className="text-xs text-fg-tertiary">자동 저장됨 · {relTime(doc.updatedTs, now)}</span>
          <button type="button" aria-label="문서 닫기" onClick={onClose} className="flex size-[28px] items-center justify-center rounded-md text-lg text-fg-secondary hover:bg-surface-chip">×</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[40px] py-[24px]">
          <Input
            value={doc.title}
            onChange={(e) => collab.setTitle(doc.id, e.target.value)}
            aria-label="문서 제목"
            placeholder="제목 없음"
            variant="ghost"
            className="mb-[16px] w-full text-3xl font-bold"
          />
          <div className="flex flex-col gap-[4px]">
            {blocks.map((block, index) => {
              const editors = here.filter((p) => p.blockId === block.id);
              return (
                <div key={block.id} className="group relative flex items-start gap-[8px]">
                  {editors.map((p, i) => (
                    <span key={p.clientId} style={{ top: 2 + i * 18 }} className={`absolute -left-[34px] rounded-sm px-[4px] text-[9px] font-semibold leading-[16px] text-fg-inverse ${p.color}`}>{p.name}</span>
                  ))}
                  {editors[0] && <span className={`pointer-events-none absolute inset-y-0 -left-[6px] w-[2px] rounded-full ${editors[0].color}`} />}
                  {block.type === 'todo' && (
                    <Checkbox checked={!!block.checked} onChange={() => collab.editBlock(doc.id, block.id, { checked: !block.checked })} aria-label="할 일 완료" className="mt-[5px]" />
                  )}
                  {block.type === 'bullet' && <span className="mt-[9px] size-[5px] shrink-0 rounded-full bg-fg" />}
                  <BlockInput
                    block={block}
                    inputRef={(el) => { if (el) refs.current.set(block.id, el); else refs.current.delete(block.id); }}
                    placeholder={block.type === 'p' ? "'/' 로 블록 선택" : ''}
                    onFocus={() => collab.setLocation(doc.id, block.id)}
                    onChange={(text) => {
                      setMenuFor(text.startsWith('/') && block.type === 'p' ? block.id : null);
                      collab.editBlock(doc.id, block.id, { text });
                    }}
                    onKeyDown={(e) => onKeyDown(e, block, index)}
                  />
                  {menuFor === block.id && (
                    <ul className="absolute left-0 top-full z-10 m-0 mt-[4px] w-[220px] list-none rounded-lg border border-solid border-border bg-surface p-[4px] shadow-card">
                      {BLOCK_MENU.filter((m) => !block.text.slice(1) || m.label.includes(block.text.slice(1)) || m.type.startsWith(block.text.slice(1).toLowerCase())).map((m) => (
                        <li key={m.type}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { apply(block, m.type); refs.current.get(block.id)?.focus(); }}
                            className="flex w-full items-center justify-between rounded-md px-[8px] py-[6px] text-left text-sm text-fg hover:bg-surface-sunken"
                          >
                            {m.label}
                            <span className="text-2xs text-fg-tertiary">{m.hint}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    aria-label="블록 삭제"
                    onClick={() => setDeletingBlock(block.id)}
                    className="mt-[6px] flex size-[22px] shrink-0 items-center justify-center rounded-md text-fg-tertiary opacity-0 hover:bg-surface-chip focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
      {deletingBlock && (
        <ConfirmDialog
          title="블록을 삭제할까요?"
          body="삭제한 블록은 복구할 수 없습니다."
          onClose={() => setDeletingBlock(null)}
          onConfirm={() => {
            collab.removeBlock(doc.id, deletingBlock);
            setDeletingBlock(null);
          }}
        />
      )}
    </>
  );
}
