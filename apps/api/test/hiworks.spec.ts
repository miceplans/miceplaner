import { afterEach, describe, expect, it, vi } from 'vitest';
import { HiworksService } from '../src/auth/hiworks';

const originalToken = process.env.OFFICE_TOKEN;
const originalUrl = process.env.HIWORKS_API_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.OFFICE_TOKEN;
  else process.env.OFFICE_TOKEN = originalToken;
  if (originalUrl === undefined) delete process.env.HIWORKS_API_URL;
  else process.env.HIWORKS_API_URL = originalUrl;
});

describe('HiworksService', () => {
  it('조직도 GET에 하이웍스가 요구하는 Content-Type을 보낸다', async () => {
    process.env.OFFICE_TOKEN = 'test-token';
    process.env.HIWORKS_API_URL = 'https://hiworks.test';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ entries: [{ name: '구성원', mail_id: 'member' }] }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new HiworksService().findMember('member@example.test')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hiworks.test/hrm/v2/organizations',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json;charset=UTF-8', Authorization: 'Bearer test-token' },
      }),
    );
  });
});
