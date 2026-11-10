/** 일시적 과부하·속도 제한에만 재시도한다. 잔액 부족(z.ai 코드 1113)처럼 다시 해도 소용없는 429는 바로 돌려준다. */
const TRANSIENT = new Set([429, 502, 503, 529]);

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
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    if (init.signal?.aborted) return res;
  }
}
