/**
 * 한국어 질의 정규화. 형태소 분석기 없이 처리한다 (서버 비용 최소화, 명세 F-10).
 * 색인은 `simple` tsvector 원문 토큰이고, 질의는 조사를 뗀 어간을 접두 일치(`:*`)로 찾는다.
 */

// 긴 조사부터 맞춘다. 떼고 남는 어간이 2자 미만이면 떼지 않는다.
const PARTICLES = [
  '으로부터', '에서부터', '에게서', '한테서', '으로써', '으로서', '이라는', '이라고', '이며', '에서는', '에서도', '에서의', '으로는', '으로도', '까지는', '까지의', '부터는', '만으로',
  '에서', '에게', '한테', '께서', '으로', '까지', '부터', '보다', '처럼', '만큼', '이나', '이란', '라는', '라고', '에는', '에도', '에의', '와의', '과의', '로는', '로도', '로의', '이다', '입니다',
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '로', '만', '며', '나', '란',
];

// 질문 어미와 흔한 불용어. 검색어로는 쓸모가 없다.
const STOPWORDS = new Set(['그리고', '그런데', '하지만', '대한', '관련', '무엇', '뭐야', '알려줘', '알려', '주세요', '어떻게', '어디', '언제', '누가', '있나요', '있어', '있는', '해줘', '대해', '에대해', '좀', '더', '및']);

const MAX_TERMS = 12;

export function stripParticle(word: string): string {
  if (!/[가-힣]/.test(word)) return word;
  for (const p of PARTICLES) {
    if (word.length - p.length >= 2 && word.endsWith(p)) return word.slice(0, -p.length);
  }
  return word;
}

/** 소문자화하고 문자·숫자 단위로 쪼갠 뒤 조사를 떼고 중복과 불용어를 없앤다. */
export function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  for (const raw of query.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || STOPWORDS.has(raw)) continue;
    const term = stripParticle(raw);
    if (term.length < 1 || (term.length === 1 && !/[0-9a-z]/.test(term)) || STOPWORDS.has(term)) continue;
    seen.add(term);
    if (seen.size >= MAX_TERMS) break;
  }
  return [...seen];
}

/** `to_tsquery('simple', …)`에 넘길 문자열. 어느 용어든 접두로 맞으면 후보가 된다. 따옴표를 이스케이프한다. */
export function toTsQuery(terms: readonly string[]): string {
  return terms.map((t) => `'${t.replace(/'/g, "''").replace(/\\/g, '\\\\')}':*`).join(' | ');
}
