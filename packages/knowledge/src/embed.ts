/** 청크 임베딩 생성기. 운영은 TEI(BGE-M3 dense), 테스트는 결정적 가짜를 쓴다. */
export type Embedder = (texts: readonly string[]) => Promise<number[][]>;

/** BGE-M3 dense 벡터 차원. DB의 vector(1024)와 같아야 한다. */
export const EMBEDDING_DIM = 1024;

const BATCH = 32;

export type TeiOptions = {
  /** TEI `--api-key`. 운영 TEI는 CloudFront로 공개되므로 반드시 둔다. Bearer 토큰으로 보낸다. */
  apiKey?: string;
  /** 요청 하나의 제한 시간(ms). 검색 질의는 짧게 두어 임베딩 서버가 느려도 lexical 결과로 바로 돌아가게 한다. */
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/** TEI의 `POST /embed`를 호출한다. 서버 주소·키는 서버 런타임 설정으로만 받는다. */
export function teiEmbedder(baseUrl: string, { apiKey, timeoutMs, fetch: fetchImpl = fetch }: TeiOptions = {}): Embedder {
  const url = `${baseUrl.replace(/\/$/, '')}/embed`;
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) };
  return async (texts) => {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: texts.slice(i, i + BATCH), normalize: true, truncate: true }),
        ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      });
      if (!res.ok) throw new Error(`임베딩 서버 오류 ${res.status}`);
      const vectors = (await res.json()) as number[][];
      if (!Array.isArray(vectors) || vectors.length !== Math.min(BATCH, texts.length - i)) throw new Error('임베딩 응답 개수가 요청과 다르다');
      for (const v of vectors) if (v.length !== EMBEDDING_DIM) throw new Error(`임베딩 차원이 ${EMBEDDING_DIM}이 아니다: ${v.length}`);
      out.push(...vectors);
    }
    return out;
  };
}

/** pgvector 입력 리터럴. */
export const toVectorLiteral = (v: readonly number[]): string => `[${v.join(',')}]`;
