/** Reciprocal Rank Fusion. 서로 다른 점수 척도의 순위 목록(FTS, trigram)을 하나로 합친다. */
export function mergeRanked<T extends { id: string }>(lists: readonly (readonly T[])[], limit: number, k = 60): (T & { score: number })[] {
  const scores = new Map<string, { item: T; score: number }>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const prev = scores.get(item.id);
      const add = 1 / (k + rank + 1);
      if (prev) prev.score += add;
      else scores.set(item.id, { item, score: add });
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, score }) => ({ ...item, score }));
}

/** 질의 용어가 처음 나오는 위치 주변을 잘라 보여준다. 없으면 앞부분이다. */
export function makeSnippet(content: string, terms: readonly string[], length = 160): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  const hit = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - Math.floor(length / 4));
  const text = flat.slice(start, start + length);
  return `${start > 0 ? '…' : ''}${text}${start + length < flat.length ? '…' : ''}`;
}
