import { Injectable, Logger } from '@nestjs/common';
import { REALTIME_EMIT_PATH, REALTIME_SECRET_HEADER, type RealtimeEmitBody } from '@miceplans/contracts';
import { config } from '../config';

export const REALTIME = Symbol('REALTIME');

/** 서비스가 푸시하는 최소 인터페이스다. 실시간 서비스 주소가 없으면 아무 일도 하지 않는다. */
export interface Realtime {
  /** 행사 구성(행사·멤버·Client 지정)이 바뀌었다. */
  eventChanged(eventId: string): void;
  /** Program·Task·Subtask가 바뀌었다. */
  itemChanged(eventId: string, itemId: string): void;
  /** 특정 사용자의 알림이 새로 생겼다. */
  notification(userId: string): void;
  /** 행사 멤버 권한이 생긴 사용자의 행사 실시간 방을 갱신한다. */
  grantEventMemberAccess(eventId: string, userId: string): void;
  /** 행사 멤버 권한이 사라진 사용자를 멤버 전용 방에서 내보낸다. */
  revokeEventMemberAccess(eventId: string, userId: string): void;
  /** 공지가 새로 올라왔다. eventId가 없으면 전체 공지다. */
  noticeChanged(eventId: string | null): void;
}

const pending = new Set<Promise<void>>();

/** 서버리스 함수는 응답 뒤 곧 멈추므로 진행 중인 푸시를 끝까지 기다린다. Vercel 핸들러가 응답 후 호출한다. */
export const flushRealtime = async (): Promise<void> => {
  while (pending.size) await Promise.allSettled([...pending]);
};

/**
 * 상시 Socket.IO 서비스(apps/realtime)에 내부 HTTP로 푸시를 보낸다. API는 서버리스라 연결·방 상태를 갖지 않는다.
 * 푸시 실패가 사용자 요청을 실패시키지 않도록 오류는 로그로만 남긴다.
 */
@Injectable()
export class RealtimeClient implements Realtime {
  private readonly logger = new Logger(RealtimeClient.name);

  private send(body: RealtimeEmitBody): void {
    const target = config.realtime;
    if (!target) return;
    const request = fetch(`${target.url}${REALTIME_EMIT_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [REALTIME_SECRET_HEADER]: target.secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3_000),
    })
      .then((res) => { if (!res.ok) this.logger.warn(`실시간 푸시 거부됨: ${body.type} ${res.status}`); })
      .catch((error) => this.logger.warn(`실시간 푸시 실패: ${body.type} ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => pending.delete(request));
    pending.add(request);
  }

  eventChanged(eventId: string) {
    this.send({ type: 'event.changed', eventId });
  }

  itemChanged(eventId: string, itemId: string) {
    this.send({ type: 'item.changed', eventId, itemId });
  }

  notification(userId: string) {
    this.send({ type: 'notification.new', userId });
  }

  grantEventMemberAccess(eventId: string, userId: string) {
    this.send({ type: 'member-access.granted', eventId, userId });
  }

  revokeEventMemberAccess(eventId: string, userId: string) {
    this.send({ type: 'member-access.revoked', eventId, userId });
  }

  noticeChanged(eventId: string | null) {
    this.send({ type: 'notice.new', eventId });
  }
}
