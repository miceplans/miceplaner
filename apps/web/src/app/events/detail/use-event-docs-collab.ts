'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COLORS,
  HEARTBEAT_MS,
  PRESENCE_TTL_MS,
  mergeDocs,
  readStored,
  seedDocs,
  visibleBlocks,
  type Block,
  type Doc,
  type Msg,
  type Presence,
} from './event-docs-model';

/** 문서 저장소·전송 계층. 지금은 localStorage + BroadcastChannel이며, 3단계에서 Hocuspocus로 교체한다. */
export function useCollab(eventId: string) {
  const storageKey = `miceplans.event-docs.v2.${eventId}`;
  const [docs, setDocs] = useState<Doc[]>(seedDocs);
  const [peers, setPeers] = useState<Presence[]>([]);
  const [me, setMe] = useState<{ clientId: string; name: string; color: string } | null>(null);
  const docsRef = useRef(docs);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastTs = useRef(0);
  const location = useRef<{ docId: string | null; blockId: string | null }>({ docId: null, blockId: null });

  const stamp = useCallback(() => {
    lastTs.current = Math.max(Date.now(), lastTs.current + 1);
    return lastTs.current;
  }, []);

  // 타이핑마다 전체 문서를 직렬화해 쓰지 않도록 마지막 변경만 잠시 뒤에 저장하고, 페이지를 떠날 때 즉시 비운다.
  const pendingSave = useRef<{ timer: number; docs: Doc[] } | null>(null);
  const flush = useCallback(() => {
    const pending = pendingSave.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingSave.current = null;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pending.docs));
    } catch {
      // 저장 실패는 화면 상태에만 영향을 주므로 무시한다.
    }
  }, [storageKey]);
  const persist = useCallback((next: Doc[]) => {
    if (pendingSave.current) window.clearTimeout(pendingSave.current.timer);
    pendingSave.current = { docs: next, timer: window.setTimeout(flush, 400) };
  }, [flush]);
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const commit = useCallback((next: Doc[]) => {
    docsRef.current = next;
    setDocs(next);
    persist(next);
  }, [persist]);

  // 내 정체성: 탭마다 다른 이름·색. 새로고침해도 유지되도록 sessionStorage에 둔다.
  useEffect(() => {
    let identity: { clientId: string; name: string; color: string } | null = null;
    try {
      const raw = window.sessionStorage.getItem('miceplans.collab-identity');
      if (raw) identity = JSON.parse(raw);
    } catch {
      // 무시
    }
    if (!identity) {
      const clientId = `c${Math.random().toString(36).slice(2, 8)}`;
      identity = { clientId, name: `사용자 ${clientId}`, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
      try {
        window.sessionStorage.setItem('miceplans.collab-identity', JSON.stringify(identity));
      } catch {
        // 무시
      }
    }
    setMe(identity);
  }, []);

  useEffect(() => {
    if (!me) return;
    commit(mergeDocs(docsRef.current, readStored(storageKey)));

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`miceplans-docs-${eventId}`);
    channelRef.current = channel;
    const send = (msg: Msg) => channel?.postMessage(msg);
    const sendPresence = () => send({ type: 'presence', presence: { clientId: me.clientId, name: me.name, color: me.color, ...location.current } });

    if (channel) {
      channel.onmessage = (ev: MessageEvent<Msg>) => {
        const msg = ev.data;
        if (msg.type === 'doc') commit(mergeDocs(docsRef.current, [msg.doc]));
        else if (msg.type === 'sync') commit(mergeDocs(docsRef.current, msg.docs));
        else if (msg.type === 'sync-req') { send({ type: 'sync', docs: docsRef.current }); sendPresence(); }
        else if (msg.type === 'presence') {
          setPeers((list) => [...list.filter((p) => p.clientId !== msg.presence.clientId), { ...msg.presence, seen: Date.now() }]);
        } else if (msg.type === 'leave') setPeers((list) => list.filter((p) => p.clientId !== msg.clientId));
      };
      send({ type: 'sync-req' });
    }
    sendPresence();

    const beat = window.setInterval(() => {
      sendPresence();
      setPeers((list) => list.filter((p) => Date.now() - p.seen < PRESENCE_TTL_MS));
    }, HEARTBEAT_MS);
    const onUnload = () => send({ type: 'leave', clientId: me.clientId });
    window.addEventListener('pagehide', onUnload);

    return () => {
      window.clearInterval(beat);
      window.removeEventListener('pagehide', onUnload);
      onUnload();
      channel?.close();
      channelRef.current = null;
    };
  }, [me, eventId, storageKey, commit]);

  const broadcastDoc = (doc: Doc) => channelRef.current?.postMessage({ type: 'doc', doc } satisfies Msg);

  const mutate = (docId: string, fn: (doc: Doc, ts: number, by: string) => Doc) => {
    if (!me) return;
    const ts = stamp();
    const next = docsRef.current.map((d) => (d.id === docId ? { ...fn(d, ts, me.clientId), updatedTs: ts } : d));
    commit(next);
    const changed = next.find((d) => d.id === docId);
    if (changed) broadcastDoc(changed);
  };

  const setLocation = (docId: string | null, blockId: string | null) => {
    location.current = { docId, blockId };
    if (me) channelRef.current?.postMessage({ type: 'presence', presence: { clientId: me.clientId, name: me.name, color: me.color, docId, blockId } } satisfies Msg);
  };

  const api = {
    editBlock: (docId: string, blockId: string, patch: Partial<Pick<Block, 'type' | 'text' | 'checked'>>) =>
      mutate(docId, (d, ts, by) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch, ts, by } : b)) })),
    insertAfter: (docId: string, afterId: string | null, block: Pick<Block, 'type' | 'text' | 'checked'>) => {
      const id = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      mutate(docId, (d, ts, by) => {
        const list = visibleBlocks(d);
        const idx = afterId ? list.findIndex((b) => b.id === afterId) : -1;
        const prev = idx >= 0 ? list[idx].pos : (list[0]?.pos ?? 1) - 1;
        const next = list[idx + 1]?.pos ?? prev + 1;
        return { ...d, blocks: [...d.blocks, { id, ...block, pos: (prev + next) / 2, ts, by }] };
      });
      return id;
    },
    removeBlock: (docId: string, blockId: string) =>
      mutate(docId, (d, ts, by) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, deleted: true, ts, by } : b)) })),
    deleteDoc: (docId: string) => mutate(docId, (d, ts, by) => ({ ...d, deletedTs: ts, deletedBy: by })),
    setTitle: (docId: string, title: string) => mutate(docId, (d, ts, by) => ({ ...d, title, titleTs: ts, titleBy: by })),
    createDoc: () => {
      if (!me) return null;
      const ts = stamp();
      const id = `d${ts.toString(36)}${me.clientId}`;
      const doc: Doc = { id, title: '', titleTs: ts, titleBy: me.clientId, createdTs: ts, updatedTs: ts, blocks: [{ id: `${id}-b1`, type: 'p', text: '', pos: 1, ts, by: me.clientId }] };
      commit(mergeDocs(docsRef.current, [doc]));
      broadcastDoc(doc);
      return id;
    },
    setLocation,
  };

  return { docs, peers, me, ...api };
}

export type Collab = ReturnType<typeof useCollab>;
