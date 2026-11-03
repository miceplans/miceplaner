/** pg Pool은 클래스가 아니므로 심볼 토큰으로 주입한다. */
export const DB_POOL = Symbol('DB_POOL');
/** 설정이 없으면 null인 LLM 어댑터. */
export const LLM_CLIENT = Symbol('LLM_CLIENT');
/** 업로드 원본 저장소(S3 또는 로컬). 설정이 없으면 null이고 업로드는 503이다. */
export const OBJECT_STORE = Symbol('OBJECT_STORE');
/** 질의·청크 임베딩 생성기(TEI). 설정이 없으면 null이고 검색은 lexical만 쓴다. */
export const EMBEDDER = Symbol('EMBEDDER');
