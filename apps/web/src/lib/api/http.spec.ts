import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('http', () => {
  it('대소문자가 다른 Content-Type 중복을 하나로 정규화한다', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { http } = await import('./http');

    await http('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'member@example.test' }),
      headers: { 'Content-Type': 'application/json', 'content-type': 'application/json' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });
});
