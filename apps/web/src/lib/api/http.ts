import { ApiError, apiBase, clearToken, getToken, STATUS_MESSAGE } from '../api';

/**
 * orval이 만든 모든 호출이 지나가는 fetch 래퍼. 세션 토큰·API 주소·401 처리·오류 메시지를 한곳에서 맡는다.
 * 응답은 JSON이면 파싱하고, 본문이 없으면 undefined, 그 밖(파일 다운로드)은 Blob으로 돌려준다.
 */
export async function http<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!apiBase) throw new ApiError(0, '[503] API 주소(NEXT_PUBLIC_API_URL)가 설정되지 않았습니다.');
  const isForm = init.body instanceof FormData;
  const authed = !['/auth/login', '/auth/register', '/auth/client/login', '/auth/client-applications'].includes(url);
  if (authed && !token) throw new ApiError(401, STATUS_MESSAGE[401]!);
  // Orval이 만든 요청은 Content-Type을 넣고, 이 래퍼도 JSON 본문에 기본값을 넣는다.
  // 객체로 합치면 대소문자가 다른 두 키가 Fetch에서 `application/json, application/json`으로
  // 병합되어 Vercel의 body 파서가 "invalid media type"으로 거부한다. Headers.set은 한 값만 남긴다.
  const headers = new Headers();
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, name) => headers.set(name, value));
  } else if (Array.isArray(init.headers)) {
    for (const [name, value] of init.headers) headers.set(name, value);
  } else {
    // 평범한 객체는 `Content-Type`과 `content-type`을 동시에 가질 수 있다.
    // Headers 생성자에 통째로 넘기면 두 값이 쉼표로 결합되므로 한 항목씩 set한다.
    for (const [name, value] of Object.entries(init.headers ?? {})) headers.set(name, value);
  }
  if (authed) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !isForm && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(`${apiBase}${url}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    if (res.status === 401 && authed) {
      clearToken();
      window.location.replace('/login');
    }
    const detail = (await res.json().catch(() => null)) as { message?: unknown } | null;
    // 서버가 준 에러 문구를 그대로 보여 주고, 없으면 상태코드만 붙인 메시지를 쓴다.
    const message = typeof detail?.message === 'string' && detail.message ? detail.message : `[${res.status}] 요청에 실패했습니다.`;
    throw new ApiError(res.status, message);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? await res.json() : await res.blob()) as T;
}
export default http;
