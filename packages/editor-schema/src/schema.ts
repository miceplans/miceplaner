import { getSchema, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { Node as PmNodeType } from '@tiptap/pm/model';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { markdownToPmJson, pmJsonToMarkdown, type PmNode } from './markdown';

/** Yjs 문서에서 에디터 본문이 들어 있는 XmlFragment 이름. TipTap Collaboration의 기본값과 같다. */
export const YDOC_FIELD = 'default';

/**
 * 웹 에디터와 서버가 같은 스키마를 쓴다. Collaboration이 Yjs 기록을 맡으므로 StarterKit의 undo/redo는 끈다.
 * 확장을 추가하거나 바꾸면 이 파일이 협업 문서의 호환 기준이 된다.
 */
export const baseExtensions: Extensions = [StarterKit.configure({ undoRedo: false })];

export const schema = getSchema(baseExtensions);

/** 스키마에 맞지 않는 JSON은 예외를 던진다. */
const toNode = (json: PmNode): PmNodeType => {
  const node = schema.nodeFromJSON(json);
  node.check();
  return node;
};

export function ydocToPmJson(ydoc: Y.Doc): PmNode {
  return yXmlFragmentToProsemirrorJSON(ydoc.getXmlFragment(YDOC_FIELD)) as PmNode;
}

export const ydocToMarkdown = (ydoc: Y.Doc): string => pmJsonToMarkdown(ydocToPmJson(ydoc));

/** 본문을 통째로 바꾸는 Yjs 트랜잭션. 같은 문서에 이어 적용되므로 접속 중인 클라이언트와 정상 병합된다. */
export function replaceYdocWithMarkdown(ydoc: Y.Doc, markdown: string, origin?: unknown): void {
  const json = markdownToPmJson(markdown);
  toNode(json);
  ydoc.transact(() => {
    const fragment = ydoc.getXmlFragment(YDOC_FIELD);
    fragment.delete(0, fragment.length);
    prosemirrorJSONToYXmlFragment(schema, json, fragment);
  }, origin);
}

export function markdownToYdoc(markdown: string): Y.Doc {
  const ydoc = new Y.Doc();
  replaceYdocWithMarkdown(ydoc, markdown);
  return ydoc;
}

export const ydocToState = (ydoc: Y.Doc): Uint8Array => Y.encodeStateAsUpdate(ydoc);

export function stateToYdoc(state: Uint8Array): Y.Doc {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, state);
  return ydoc;
}
