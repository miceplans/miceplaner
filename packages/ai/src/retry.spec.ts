import { describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from './retry';

const res = (status: number, body = '') => new Response(body, { status });

describe('fetchWithRetry', () => {
  it('과부하(529)는 다시 시도해 성공 응답을 돌려준다', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(529)).mockResolvedValueOnce(res(200, 'ok'));
    const r = await fetchWithRetry(f as unknown as typeof fetch, 'http://x', {}, { baseDelayMs: 1 });
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('잔액 부족(1113)은 재시도하지 않는다', async () => {
    const f = vi.fn().mockResolvedValue(res(429, '{"error":{"code":"1113"}}'));
    const r = await fetchWithRetry(f as unknown as typeof fetch, 'http://x', {}, { baseDelayMs: 1 });
    expect(r.status).toBe(429);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('재시도 횟수를 넘기면 마지막 응답을 돌려준다', async () => {
    const f = vi.fn().mockImplementation(async () => res(529));
    const r = await fetchWithRetry(f as unknown as typeof fetch, 'http://x', {}, { retries: 2, baseDelayMs: 1 });
    expect(r.status).toBe(529);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('일반 오류(400)는 재시도하지 않는다', async () => {
    const f = vi.fn().mockResolvedValue(res(400));
    await fetchWithRetry(f as unknown as typeof fetch, 'http://x', {}, { baseDelayMs: 1 });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
