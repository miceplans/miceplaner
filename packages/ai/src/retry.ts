/** 일시적 과부하·속도 제한에만 재시도한다. 잔액 부족(z.ai 코드 1113)처럼 다시 해도 소용없는 429는 바로 돌려준다. */
const TRANSIENT = new Set([429, 502, 503, 529]);

/** 재시도 대기. signal이 끊기면 바로 끝나 호출 쪽의 마감(AI_CHAT_DEADLINE_MS)을 넘겨 기다리지 않는다. */
const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });

export async function fetchWithRetry(
  doFetch: typeof fetch,
  url: string,
  init: RequestInit,
  { retries = 3, baseDelayMs = 1500 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await doFetch(url, init);
    if (!TRANSIENT.has(res.status) || attempt >= retries) return res;
    if (res.status === 429 && /"code"\s*:\s*"?1113"?/.test(await res.clone().text())) return res;
    await res.body?.cancel();
    await wait(baseDelayMs * 2 ** attempt, init.signal);
    init.signal?.throwIfAborted();
  }
}
