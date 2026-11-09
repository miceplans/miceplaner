import { ApiError, apiBase, clearToken, getToken, STATUS_MESSAGE } from '../api';

/**
 * orval이 만든 모든 호출이 지나가는 fetch 래퍼. 세션 토큰·API 주소·401 처리·오류 메시지를 한곳에서 맡는다.
 * 응답은 JSON이면 파싱하고, 본문이 없으면 undefined, 그 밖(파일 다운로드)은 Blob으로 돌려준다.
 */
export async function http<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!apiBase) throw new ApiError(0, 'API 주소(NEXT_PUBLIC_API_URL)가 설정되지 않았다');
  const isForm = init.body instanceof FormData;
  const authed = !url.startsWith('/auth/login') && !url.startsWith('/auth/register');
  if (authed && !token) throw new ApiError(401, STATUS_MESSAGE[401]!);
  const res = await fetch(`${apiBase}${url}`, {
    ...init,
    headers: {
      ...(authed ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body && !isForm ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401 && authed) {
      clearToken();
      window.location.replace('/login');
    }
    const detail = (await res.json().catch(() => null)) as { message?: unknown } | null;
    // 로그인·가입은 서버가 준 사유(비밀번호 오류 등)를 그대로 보여 준다.
    const message = !authed && typeof detail?.message === 'string' ? detail.message : (STATUS_MESSAGE[res.status] ?? `요청에 실패했다 (${res.status})`);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? await res.json() : await res.blob()) as T;
}
export default http;
