import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { eventRole, getUserById, listEvents, withContext } from '@miceplans/db';
import type { Server, Socket } from 'socket.io';
import type { Pool } from '@miceplans/db';
import { config } from '../config';
import { DB_POOL } from '../tokens';
import { verifySession } from '../auth/jwt';

export const REALTIME = Symbol('REALTIME');

/** 서비스가 푸시하는 최소 인터페이스다. 게이트웨이가 없으면 아무 일도 하지 않는다. */
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
}

const tokenOf = (socket: Socket): string | undefined => {
  const auth = socket.handshake.auth as { token?: string };
  const header = socket.handshake.headers.authorization;
  return auth.token ?? (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined);
};

/**
 * Socket.IO 게이트웨이 (명세 3.2, F-06). 각 소켓은 DB RLS로 볼 수 있는 행사 방에만 들어간다.
 * 멤버 전용 방은 권한 회수 때 즉시 비워 별도 편집 채널을 추가해도 권한을 우회하지 않는다.
 */
@WebSocketGateway({ cors: config.webOrigin ? { origin: config.webOrigin.split(','), credentials: true } : false })
@Injectable()
export class RealtimeGateway implements Realtime, OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server?: Server;

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  afterInit(server: Server) {
    this.server = server;
  }

  async handleConnection(socket: Socket) {
    const token = tokenOf(socket);
    if (!token) return socket.disconnect(true);
    let payload;
    try {
      payload = await verifySession(token);
    } catch {
      return socket.disconnect(true);
    }
    const userId = payload.sub;
    if (!userId) return socket.disconnect(true);
    const user = await withContext(this.pool, { workspaceId: config.workspaceId, userId, role: 'staff' }, (db) => getUserById(db, userId)).catch(
      () => undefined,
    );
    if (!user || user.role === 'client') return socket.disconnect(true);

    const context = { workspaceId: config.workspaceId, userId: user.id, role: user.role } as const;
    const events = await withContext(this.pool, context, (db) => listEvents(db, {})).catch(() => []);
    const rooms = await Promise.all(events.map(async (event) => {
      const role = await withContext(this.pool, context, (db) => eventRole(db, event.id)).catch(() => 'client' as const);
      return role === 'pm' || role === 'am' || role === 'member'
        ? [`event:${event.id}`, `event-member:${event.id}`]
        : [`event:${event.id}`];
    }));
    socket.join(rooms.flat());
    socket.join(`user:${user.id}`);
    socket.data.user = { userId: user.id, role: user.role };
  }

  eventChanged(eventId: string) {
    this.server?.to(`event:${eventId}`).emit('event.changed', { eventId });
  }

  itemChanged(eventId: string, itemId: string) {
    this.server?.to(`event:${eventId}`).emit('item.changed', { eventId, itemId });
  }

  notification(userId: string) {
    this.server?.to(`user:${userId}`).emit('notification.new', { at: new Date().toISOString() });
  }

  grantEventMemberAccess(eventId: string, userId: string) {
    this.server?.in(`user:${userId}`).socketsJoin([`event:${eventId}`, `event-member:${eventId}`]);
  }

  revokeEventMemberAccess(eventId: string, userId: string) {
    const sockets = this.server?.in(`user:${userId}`);
    sockets?.emit('event.member-access.revoked', { eventId });
    sockets?.socketsLeave(`event-member:${eventId}`);
  }
}
