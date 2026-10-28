import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { getUserById, withContext } from '@miceplans/db';
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
}

const tokenOf = (socket: Socket): string | undefined => {
  const auth = socket.handshake.auth as { token?: string };
  const header = socket.handshake.headers.authorization;
  return auth.token ?? (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined);
};

/**
 * Socket.IO 게이트웨이 (명세 3.2, F-06). 낮은 사용자는 전체 방에 들어가 쿼리 캐시를 무효화하고,
 * 알림은 사용자 방으로만 별도 전달한다. Client는 낮은 알림 채널에 연결할 수 없다 (명세 2.2).
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

    socket.join('internal');
    socket.join(`user:${user.id}`);
    socket.data.user = { userId: user.id, role: user.role };
  }

  eventChanged(eventId: string) {
    this.server?.to('internal').emit('event.changed', { eventId });
  }

  itemChanged(eventId: string, itemId: string) {
    this.server?.to('internal').emit('item.changed', { eventId, itemId });
  }

  notification(userId: string) {
    this.server?.to(`user:${userId}`).emit('notification.new', { at: new Date().toISOString() });
  }
}
