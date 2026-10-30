/**
 * ProseMirror JSON ↔ Markdown. Markdown은 검색·AI용 파생본이며 Yjs 원본이 기준이다 (명세 F-09).
 * 에디터가 만드는 노드(문단·제목·목록·인용·코드블록·구분선)와 마크(굵게·기울임·취소선·코드·링크)만 다룬다.
 */
export type PmMark = { type: string; attrs?: Record<string, unknown> };
export type PmNode = { type: string; attrs?: Record<string, unknown>; content?: PmNode[]; text?: string; marks?: PmMark[] };

// ── 직렬화 ───────────────────────────────────────────────────────────────

const wrap = (text: string, mark: PmMark): string => {
  switch (mark.type) {
    case 'code': return `\`${text}\``;
    case 'bold': return `**${text}**`;
    case 'italic': return `*${text}*`;
    case 'strike': return `~~${text}~~`;
    case 'link': return `[${text}](${String(mark.attrs?.href ?? '')})`;
    default: return text;
  }
};
// 안쪽부터 감싸는 순서: code → link → strike → italic → bold.
const MARK_ORDER = ['code', 'link', 'strike', 'italic', 'bold'];

function inline(nodes: PmNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n';
      if (n.type !== 'text') return inline(n.content);
      const marks = [...(n.marks ?? [])].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
      return marks.reduce((text, m) => wrap(text, m), n.text ?? '');
    })
    .join('');
}

const indent = (text: string, prefix: string, first = prefix) => text.split('\n').map((l, i) => (l ? (i === 0 ? first : prefix) + l : l)).join('\n');

function block(node: PmNode): string {
  const kids = node.content ?? [];
  switch (node.type) {
    case 'paragraph': return inline(kids);
    case 'heading': return `${'#'.repeat(Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6))} ${inline(kids)}`;
    case 'codeBlock': return `\`\`\`${String(node.attrs?.language ?? '')}\n${kids.map((k) => k.text ?? '').join('')}\n\`\`\``;
    case 'blockquote': return indent(blocks(kids), '> ');
    case 'horizontalRule': return '---';
    case 'bulletList': return kids.map((li) => indent(blocks(li.content ?? [], '\n'), '  ', '- ')).join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return kids.map((li, i) => indent(blocks(li.content ?? [], '\n'), '   ', `${start + i}. `)).join('\n');
    }
    default: return inline(kids);
  }
}

function blocks(nodes: PmNode[], sep = '\n\n'): string {
  return nodes.map(block).join(sep);
}

/** 끝 개행이 없는 정규형이다. 같은 문서는 항상 같은 문자열이라 본문 비교와 version 판정이 안정적이다. */
export function pmJsonToMarkdown(doc: PmNode): string {
  return blocks(doc.content ?? []).trim();
}

// ── 파싱 ─────────────────────────────────────────────────────────────────

const INLINE_PATTERNS: { re: RegExp; mark: (m: RegExpExecArray) => PmMark; text: (m: RegExpExecArray) => string; raw?: boolean }[] = [
  { re: /`([^`\n]+)`/, mark: () => ({ type: 'code' }), text: (m) => m[1]!, raw: true },
  { re: /\[([^\]\n]+)\]\(([^)\s]+)\)/, mark: (m) => ({ type: 'link', attrs: { href: m[2]! } }), text: (m) => m[1]! },
  { re: /\*\*(.+?)\*\*/, mark: () => ({ type: 'bold' }), text: (m) => m[1]! },
  { re: /~~(.+?)~~/, mark: () => ({ type: 'strike' }), text: (m) => m[1]! },
  { re: /(?<![*\w])\*([^*\n]+?)\*(?![*\w])/, mark: () => ({ type: 'italic' }), text: (m) => m[1]! },
  { re: /(?<![\w_])_([^_\n]+?)_(?![\w_])/, mark: () => ({ type: 'italic' }), text: (m) => m[1]! },
];

function parseInline(text: string, marks: PmMark[] = []): PmNode[] {
  if (!text) return [];
  let best: { index: number; length: number; pattern: (typeof INLINE_PATTERNS)[number]; match: RegExpExecArray } | undefined;
  for (const pattern of INLINE_PATTERNS) {
    const match = pattern.re.exec(text);
    if (match && (!best || match.index < best.index)) best = { index: match.index, length: match[0].length, pattern, match };
  }
  if (!best) return [{ type: 'text', text, ...(marks.length ? { marks } : {}) }];
  const before = text.slice(0, best.index);
  const after = text.slice(best.index + best.length);
  const inner = best.pattern.text(best.match);
  const nextMarks = [...marks, best.pattern.mark(best.match)];
  return [
    ...(before ? [{ type: 'text', text: before, ...(marks.length ? { marks } : {}) }] : []),
    ...(best.pattern.raw ? [{ type: 'text', text: inner, marks: nextMarks }] : parseInline(inner, nextMarks)),
    ...parseInline(after, marks),
  ];
}

/** 줄 끝 공백 두 칸은 hardBreak, 그 밖의 줄바꿈은 공백이다. */
function paragraphContent(lines: string[]): PmNode[] {
  const out: PmNode[] = [];
  lines.forEach((line, i) => {
    const hard = / {2,}$/.test(line) && i < lines.length - 1;
    out.push(...parseInline(line.replace(/ +$/, '')));
    if (hard) out.push({ type: 'hardBreak' });
    else if (i < lines.length - 1) out.push(...parseInline(' '));
  });
  return out;
}

const FENCE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const startsBlock = (line: string) => FENCE.test(line) || HEADING.test(line) || HR.test(line) || LIST_ITEM.test(line) || /^\s*>/.test(line);

/** listItem·blockquote는 빈 내용을 허용하지 않아 빈 문단을 채운다. */
const nonEmpty = (nodes: PmNode[]): PmNode[] => (nodes.length ? nodes : [{ type: 'paragraph' }]);

function parseBlocks(lines: string[]): PmNode[] {
  const out: PmNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) body.push(lines[i++]!);
      i++;
      const text = body.join('\n');
      out.push({ type: 'codeBlock', attrs: { language: fence[2] || null }, ...(text ? { content: [{ type: 'text', text }] } : {}) });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const content = parseInline(heading[2]!);
      out.push({ type: 'heading', attrs: { level: heading[1]!.length }, ...(content.length ? { content } : {}) });
      i++;
      continue;
    }
    if (HR.test(line)) { out.push({ type: 'horizontalRule' }); i++; continue; }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) quote.push(lines[i++]!.replace(/^\s*> ?/, ''));
      out.push({ type: 'blockquote', content: nonEmpty(parseBlocks(quote)) });
      continue;
    }
    const first = LIST_ITEM.exec(line);
    if (first) {
      const base = first[1]!.length;
      const ordered = /\d/.test(first[2]!);
      const items: PmNode[] = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]!);
        if (!m || m[1]!.length !== base || /\d/.test(m[2]!) !== ordered) break;
        const body = [m[3]!];
        i++;
        // 더 깊이 들여쓴 줄(중첩 목록·이어지는 문단)은 이 항목에 속한다.
        while (i < lines.length && (lines[i]!.trim() === '' ? /^\s+\S/.test(lines[i + 1] ?? '') && (lines[i + 1]!.length - lines[i + 1]!.trimStart().length) > base : (lines[i]!.length - lines[i]!.trimStart().length) > base)) {
          body.push(lines[i++]!.slice(Math.min(base + 2, lines[i - 1]!.length - lines[i - 1]!.trimStart().length)));
        }
        items.push({ type: 'listItem', content: nonEmpty(parseBlocks(body)) });
      }
      out.push(ordered ? { type: 'orderedList', attrs: { start: Number.parseInt(first[2]!, 10) || 1 }, content: items } : { type: 'bulletList', content: items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && (para.length === 0 || !startsBlock(lines[i]!))) para.push(lines[i++]!);
    out.push({ type: 'paragraph', content: paragraphContent(para) });
  }
  return out;
}

export function markdownToPmJson(markdown: string): PmNode {
  const content = parseBlocks(markdown.replace(/\r\n?/g, '\n').split('\n'));
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}
