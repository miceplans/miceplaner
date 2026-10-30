/** pg Pool은 클래스가 아니므로 심볼 토큰으로 주입한다. */
export const DB_POOL = Symbol('DB_POOL');
/** 설정이 없으면 null인 LLM 어댑터. */
export const LLM_CLIENT = Symbol('LLM_CLIENT');
