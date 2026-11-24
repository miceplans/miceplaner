import { z } from 'zod';

/**
 * API(서버리스)가 상시 Socket.IO 서비스에 보내는 내부 푸시 요청이다. 브라우저에는 노출하지 않는다.
 * 소켓 연결·방 상태는 Socket.IO 서비스만 가지며, API는 이 계약으로 방에 이벤트를 내보내거나 방 구성을 바꾸라고 요청한다.
 */
export const realtimeEmitBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('event.changed'), eventId: z.uuid() }),
  z.object({ type: z.literal('item.changed'), eventId: z.uuid(), itemId: z.uuid() }),
  z.object({ type: z.literal('notification.new'), userId: z.uuid() }),
  z.object({ type: z.literal('member-access.granted'), eventId: z.uuid(), userId: z.uuid() }),
  z.object({ type: z.literal('member-access.revoked'), eventId: z.uuid(), userId: z.uuid() }),
  z.object({ type: z.literal('notice.new'), eventId: z.uuid().nullable() }),
]);
export type RealtimeEmitBody = z.infer<typeof realtimeEmitBody>;

/** 내부 푸시 경로와 인증 헤더 이름. */
export const REALTIME_EMIT_PATH = '/internal/emit';
export const REALTIME_SECRET_HEADER = 'x-internal-secret';
