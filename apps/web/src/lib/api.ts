import type { AuthSessionDto, ChatBody, ChatEvent, DocPageDto, FileDto, ProposalDto } from '@miceplans/contracts';

/** 빌드 시점에 정해지는 공개 주소다. 비밀 값은 두지 않는다. */
export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
export const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL ?? '';

const TOKEN_KEY = 'miceplans.token';

/** 세션 토큰은 탭을 닫으면 사라지도록 sessionStorage에 둔다. */
export const getToken = (): string | null => (typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY));
export const setToken = (token: string): void => window.sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => window.sessionStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const STATUS_MESSAGE: Record<number, string> = {
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

export async function decideProposal(id: string, action: 'approve' | 'reject'): Promise<ProposalDto> {
  return (await (await request(`/ai/proposals/${id}/${action}`, { method: 'POST', body: '{}' })).json()) as ProposalDto;
}

export async function getDocPage(docId: string): Promise<DocPageDto> {
  return (await (await request(`/docs/${docId}`, { method: 'GET' })).json()) as DocPageDto;
}

/** 이메일·비밀번호로 로그인하거나 가입한다. 성공하면 세션 토큰을 저장한다. 실패 사유는 서버 메시지를 그대로 쓴다. */
export async function signIn(mode: 'login' | 'register', body: { email: string; password: string }): Promise<AuthSessionDto> {
  if (!apiBase) throw new ApiError(0, 'API 주소(NEXT_PUBLIC_API_URL)가 설정되지 않았다');
  const res = await fetch(`${apiBase}/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { message?: unknown } | null;
    throw new ApiError(res.status, typeof detail?.message === 'string' ? detail.message : `요청에 실패했다 (${res.status})`);
  }
  const session = (await res.json()) as AuthSessionDto;
  setToken(session.accessToken);
  return session;
}

export async function getMe(): Promise<{ id: string; name: string; role: string }> {
  return (await (await request('/auth/me', { method: 'GET' })).json()) as { id: string; name: string; role: string };
}

export async function listFiles(eventId: string): Promise<FileDto[]> {
  return (await (await request(`/events/${eventId}/files`, { method: 'GET' })).json()) as FileDto[];
}

export async function uploadFile(eventId: string, file: File): Promise<FileDto> {
  const form = new FormData();
  form.append('file', file);
  return (await (await request(`/events/${eventId}/files`, { method: 'POST', body: form })).json()) as FileDto;
}

export async function deleteFile(id: string): Promise<void> {
  await request(`/files/${id}`, { method: 'DELETE' });
}

/** 토큰이 헤더에 있어야 해서 링크 대신 받아서 저장한다. */
export async function downloadFile(file: Pick<FileDto, 'id' | 'name'>): Promise<void> {
  const blob = await (await request(`/files/${file.id}/download`, { method: 'GET' })).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
