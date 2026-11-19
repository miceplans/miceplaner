const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 행사 상세에서는 그 행사를 대화의 기본 맥락으로 보낸다. 정적 export라 상세는 `/events/detail?id=<uuid>`이다(ADR 0001).
 * useSearchParams는 레이아웃에서 Suspense 경계를 요구하므로, 전송 시점에 location에서 직접 읽는다.
 */
export const eventIdFrom = (pathname: string, search: string): string | undefined => {
  if (!/^\/events\/detail\/?$/.test(pathname)) return undefined;
  const id = new URLSearchParams(search).get('id');
  return id && UUID.test(id) ? id : undefined;
};
