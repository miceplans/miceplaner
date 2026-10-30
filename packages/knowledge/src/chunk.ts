export type Chunk = { index: number; heading: string; content: string };

export type ChunkOptions = { maxChars?: number };

const HEADING = /^(#{1,6})\s+(.*)$/;

/**
 * Markdown 파생본을 제목 경로가 붙은 청크로 나눈다. 검색 API와 색인 코드가 같은 함수를 쓴다 (명세 F-10).
 * 제목 단위로 끊고, 한 절이 maxChars를 넘으면 문단 경계에서 나눈다.
 */
export function chunkMarkdown(markdown: string, { maxChars = 800 }: ChunkOptions = {}): Chunk[] {
  const path: string[] = [];
  const sections: { heading: string; lines: string[] }[] = [{ heading: '', lines: [] }];
  let fence = false;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = fence ? null : HEADING.exec(line);
    if (m) {
      path.length = m[1]!.length - 1;
      path[path.length] = m[2]!.trim();
      sections.push({ heading: path.filter(Boolean).join(' > '), lines: [] });
    } else {
      sections[sections.length - 1]!.lines.push(line);
    }
  }

  const chunks: Chunk[] = [];
  for (const { heading, lines } of sections) {
    for (const content of splitParagraphs(lines.join('\n'), maxChars)) chunks.push({ index: chunks.length, heading, content });
  }
  return chunks;
}

function splitParagraphs(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) out.push(current.trim());
    current = '';
  };
  for (const paragraph of text.split(/\n{2,}/)) {
    const p = paragraph.trim();
    if (!p) continue;
    if (p.length > maxChars) {
      flush();
      for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars));
    } else if (current && current.length + p.length + 2 > maxChars) {
      flush();
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  flush();
  return out;
}
