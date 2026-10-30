'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import type { DocPageDto } from '@miceplans/contracts';
import { baseExtensions } from '@miceplans/editor-schema';
import { ApiError, collabUrl, getDocPage, getMe, getToken } from '@/lib/api';

const COLORS = ['#e5484d', '#2f6fed', '#2a9d62', '#c26d00', '#8e4ec6', '#0b8fa3'];
const colorOf = (name: string) => COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length]!;

const VISIBILITY_LABEL: Record<DocPageDto['visibility'], string> = { all: '전체 공개', members: '행사 멤버', managers: 'PM·AM만' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Peer = { clientId: number; name: string; color: string };

/**
 * 행사 위키 협업 에디터 (명세 F-09). Yjs 상태는 협업 서버가 저장하고, PM·AM만 편집한다.
 * 읽기 전용 접속자도 다른 사람의 커서와 접속자 표시는 볼 수 있다.
 */
export function WikiEditor() {
  const docId = useSearchParams().get('doc') ?? '';
  const [page, setPage] = useState<DocPageDto | null>(null);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!UUID.test(docId)) {
      setError('문서 주소가 올바르지 않다');
      return;
    }
    Promise.all([getDocPage(docId), getMe()])
      .then(([p, m]) => {
        setPage(p);
        setMe(m);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : '문서를 불러오지 못했다'));
  }, [docId]);

  if (error) return <p role="alert" className="p-[24px] text-base text-notice">{error}</p>;
  if (!page || !me) return <p className="p-[24px] text-base text-fg-secondary">불러오는 중…</p>;
  return <Collaborative page={page} userName={me.name} />;
}

function Collaborative({ page, userName }: { page: DocPageDto; userName: string }) {
  const ydoc = useMemo(() => new Y.Doc(), []);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [readOnly, setReadOnly] = useState(true);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!collabUrl || !token) {
      setFailure(!token ? '로그인이 필요하다' : '협업 서버 주소(NEXT_PUBLIC_COLLAB_URL)가 설정되지 않았다');
      return;
    }
    const p = new HocuspocusProvider({
      url: collabUrl,
      name: page.id,
      token,
      document: ydoc,
      onStatus: ({ status: s }) => setStatus(s as typeof status),
      onAuthenticated: ({ scope }) => setReadOnly(scope === 'readonly'),
      onAuthenticationFailed: () => setFailure('이 문서를 열 권한이 없다'),
      onAwarenessChange: ({ states }) =>
        setPeers(states.flatMap((s) => (s.user ? [{ clientId: s.clientId, name: String(s.user.name), color: String(s.user.color) }] : []))),
    });
    setProvider(p);
    return () => {
      p.destroy();
      setProvider(null);
    };
  }, [page.id, ydoc]);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-[16px] p-[24px]">
      <header className="flex flex-wrap items-center justify-between gap-[12px]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="text-xl font-semibold text-fg">{page.title}</h1>
          <p className="text-2xs text-fg-secondary">
            열람 범위 {VISIBILITY_LABEL[page.visibility]} · {readOnly ? '읽기 전용' : '편집 가능'} ·{' '}
            {status === 'connected' ? '실시간 연결됨' : status === 'connecting' ? '연결 중…' : '연결 끊김, 재접속하면 동기화된다'}
          </p>
        </div>
        <ul className="flex items-center gap-[6px]" aria-label="접속자">
          {peers.map((peer) => (
            <li key={peer.clientId} title={peer.name} style={{ background: peer.color }} className="flex size-[24px] items-center justify-center rounded-lg text-2xs font-semibold text-fg-inverse">
              {peer.name[0]}
            </li>
          ))}
        </ul>
      </header>
      {failure ? (
        <p role="alert" className="rounded-sm bg-notice-bg px-[12px] py-[8px] text-2xs text-notice">{failure}</p>
      ) : (
        provider && <Surface ydoc={ydoc} provider={provider} readOnly={readOnly} userName={userName} />
      )}
    </div>
  );
}

function Surface({ ydoc, provider, readOnly, userName }: { ydoc: Y.Doc; provider: HocuspocusProvider; readOnly: boolean; userName: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      ...baseExtensions,
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({ provider, user: { name: userName, color: colorOf(userName) } }),
    ],
    editorProps: { attributes: { class: 'wiki-prose min-h-[320px] outline-none', 'aria-label': '위키 본문' } },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div className="flex flex-col gap-[8px]">
      {!readOnly && editor && <Toolbar editor={editor} />}
      <div className="rounded-md border border-border bg-surface p-[20px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const items: { label: string; active: boolean; run: () => void }[] = [
    { label: 'B', active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'I', active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'H1', active: editor.isActive('heading', { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'H2', active: editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: '• 목록', active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: '1. 목록', active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: '인용', active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: '코드', active: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() },
  ];
  return (
    <div role="toolbar" aria-label="서식" className="flex flex-wrap gap-[4px]">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-pressed={item.active}
          onClick={item.run}
          className={`h-[28px] rounded-sm border border-border px-[10px] text-2xs ${item.active ? 'bg-brand text-fg-inverse' : 'bg-surface text-fg-secondary'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
