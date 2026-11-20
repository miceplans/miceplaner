import { afterEach, describe, expect, it, vi } from 'vitest';
import { HiworksService, classifyTeam } from '../src/auth/hiworks';

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

  it('기획·행정·개발·최상위를 뺀 조직은 디자인팀 소분류로 분류한다', () => {
    expect(classifyTeam(undefined)).toEqual({});
    expect(classifyTeam('기획팀')).toEqual({ team: '기획팀' });
    expect(classifyTeam('행정팀')).toEqual({ team: '행정팀' });
    expect(classifyTeam('개발팀')).toEqual({ team: '개발팀' });
    expect(classifyTeam('디자인팀')).toEqual({ team: '디자인팀' });
    expect(classifyTeam('영상팀')).toEqual({ team: '디자인팀', subTeam: '영상팀' });
    expect(classifyTeam('콘텐츠 제작팀')).toEqual({ team: '디자인팀', subTeam: '콘텐츠 제작팀' });
  });

  it('조직도 노드 이름에 따라 구성원에 팀·소분류를 붙인다', async () => {
    process.env.OFFICE_TOKEN = 'test-token';
    process.env.HIWORKS_API_URL = 'https://hiworks.test';
    const org = {
      entries: [{ name: '대표', email: 'ceo@example.test' }],
      nodes: [
        { name: '기획팀', entries: [{ name: '기획', email: 'plan@example.test' }] },
        { name: '영상팀', entries: [{ name: '영상', email: 'video@example.test' }] },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(org))));

    const service = new HiworksService();
    await expect(service.findMember('ceo@example.test')).resolves.toEqual({ name: '대표', email: 'ceo@example.test' });
    await expect(service.findMember('plan@example.test')).resolves.toMatchObject({ team: '기획팀' });
    await expect(service.findMember('video@example.test')).resolves.toMatchObject({ team: '디자인팀', subTeam: '영상팀' });
  });
});
