import type { ChatBody, ChatEvent } from '@miceplans/contracts';

/** 빌드 시점에 정해지는 공개 주소다. 비밀 값은 두지 않는다. */
export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
export const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL ?? '';

const TOKEN_KEY = 'miceplans.token';

/** 세션 토큰은 탭을 닫으면 사라지도록 sessionStorage에 둔다. */
export const getToken = (): string | null => (typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY));
export const setToken = (token: string): void => window.sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => {
  window.sessionStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const STATUS_MESSAGE: Record<number, string> = {
  401: '로그인이 필요하다',
  403: '권한이 없다',
  404: '대상을 찾을 수 없다',
  409: '다른 사용자가 먼저 바꿨거나 이미 결정된 제안이다',
  429: 'AI 질의가 너무 잦다. 잠시 후 다시 시도하라',
  413: '파일이 너무 크다 (최대 20MB)',
  503: 'AI·파일 저장소 등 서버 기능이 설정되지 않았다',
};

async function request(path: string, init: RequestInit): Promise<Response> {
  const token = getToken();
  if (!apiBase) throw new ApiError(0, 'API 주소(NEXT_PUBLIC_API_URL)가 설정되지 않았다');
  if (!token) throw new ApiError(401, STATUS_MESSAGE[401]!);
  const res = await fetch(`${apiBase}${path}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}`, ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }) } });
  if (res.status === 401) {
    clearToken();
    window.location.replace('/login');
  }
  if (!res.ok) throw new ApiError(res.status, STATUS_MESSAGE[res.status] ?? `요청에 실패했다 (${res.status})`);
  return res;
}

/** SSE 본문에서 완성된 블록을 꺼내 이벤트로 바꾸고, 아직 덜 온 나머지를 돌려준다. */
export function parseSse(buffer: string): { events: ChatEvent[]; rest: string } {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: ChatEvent[] = [];
  for (const block of blocks) {
    const data = block.split('\n').find((l) => l.startsWith('data: '));
    if (!data) continue;
    try {
      events.push(JSON.parse(data.slice(6)) as ChatEvent);
    } catch {
      // 깨진 블록은 건너뛴다.
    }
  }
  return { events, rest };
}

export async function streamChat(body: ChatBody, onEvent: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await request('/ai/chat', { method: 'POST', body: JSON.stringify(body), signal });
  if (!res.body) throw new ApiError(res.status, '응답 본문이 없다');
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const { events, rest } = parseSse(buffer);
    buffer = rest;
    events.forEach(onEvent);
  }
}

