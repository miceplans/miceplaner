import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { jwtVerify } from 'jose';
import { realtimeEmitBody, REALTIME_EMIT_PATH, REALTIME_SECRET_HEADER, type RealtimeEmitBody } from '@miceplans/contracts';
import { eventRole, getUserById, listEvents, withContext, type Pool } from '@miceplans/db';
import { isRole } from '@miceplans/domain';
import { config } from './config';

const tokenOf = (socket: Socket): string | undefined => {
  const auth = socket.handshake.auth as { token?: string };
  const header = socket.handshake.headers.authorization;
  return auth.token ?? (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined);
};

const readJson = async (req: IncomingMessage, limit = 4_000): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('본문이 너무 크다');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const send = (res: ServerResponse, status: number, body?: unknown) => {
  res.writeHead(status, body === undefined ? {} : { 'content-type': 'application/json' });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};

const secretMatches = (given: string | undefined): boolean => {
  const expected = config.internalSecret;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** 내부 푸시 하나를 Socket.IO 방에 반영한다. */
export function applyEmit(io: Server, body: RealtimeEmitBody): void {
  switch (body.type) {
    case 'event.changed':
      io.to(`event:${body.eventId}`).emit('event.changed', { eventId: body.eventId });
      return;
    case 'item.changed':
      io.to(`event:${body.eventId}`).emit('item.changed', { eventId: body.eventId, itemId: body.itemId });
      return;
    case 'notification.new':
      io.to(`user:${body.userId}`).emit('notification.new', { at: new Date().toISOString() });
      return;
    case 'member-access.granted':
      io.in(`user:${body.userId}`).socketsJoin([`event:${body.eventId}`, `event-member:${body.eventId}`]);
      return;
    case 'member-access.revoked': {
      const sockets = io.in(`user:${body.userId}`);
      sockets.emit('event.member-access.revoked', { eventId: body.eventId });
      sockets.socketsLeave(`event-member:${body.eventId}`);
      return;
    }
    case 'notice.new':
      // 전체 공지는 내부 직원 전원의 방에, 행사 공지는 그 행사 멤버 방에만 보낸다.
      io.to(body.eventId === null ? 'workspace' : `event-member:${body.eventId}`).emit('notice.new', { at: new Date().toISOString() });
      return;
  }
}

/**
 * 상시 Socket.IO 서비스 (명세 3.2, F-06). 서버리스 API와 분리해 연결·방 상태를 한 프로세스가 가진다.
 * 각 소켓은 DB RLS로 볼 수 있는 행사 방에만 들어가고 Client는 연결할 수 없다.
 * 멤버 전용 방은 권한 회수 때 `POST /internal/emit`으로 즉시 비운다(공유 비밀 필요).
 * 단일 머신 운영이 전제다. 둘 이상 운영하려면 Socket.IO Redis/Postgres 어댑터가 필요하다(ADR).
 */
export function createRealtimeServer(pool: Pool): { http: HttpServer; io: Server; listen: (port?: number) => Promise<number>; close: () => Promise<void> } {
  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://realtime');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
    if (url.pathname === REALTIME_EMIT_PATH) {
      if (req.method !== 'POST' || !secretMatches(req.headers[REALTIME_SECRET_HEADER] as string | undefined)) return send(res, 403, { error: 'forbidden' });
      try {
        applyEmit(io, realtimeEmitBody.parse(await readJson(req)));
        return send(res, 204);
      } catch (error) {
        return error instanceof SyntaxError || (error as { name?: string }).name === 'ZodError' ? send(res, 400, { error: 'invalid request' }) : send(res, 500, { error: 'failed' });
      }
    }
    return send(res, 404, { error: 'not found' });
  });

  const origins = config.webOrigin.split(',').filter(Boolean);
  const io = new Server(http, { cors: origins.length ? { origin: origins, credentials: true } : undefined, serveClient: false });

  io.on('connection', async (socket) => {
    const token = tokenOf(socket);
    if (!token) return void socket.disconnect(true);
    let userId: string | undefined;
    try {
      userId = (await jwtVerify(token, new TextEncoder().encode(config.jwtSecret))).payload.sub;
    } catch {
      return void socket.disconnect(true);
    }
    if (!userId) return void socket.disconnect(true);
    const id = userId;
    // users_select 정책이 본인 행을 항상 허용하므로 임시 역할로 본인 행을 읽는다.
    const user = await withContext(pool, { workspaceId: config.workspaceId, userId: id, role: 'staff' }, (db) => getUserById(db, id)).catch(() => undefined);
    if (!user || !isRole(user.role) || user.role === 'client') return void socket.disconnect(true);

    const context = { workspaceId: config.workspaceId, userId: user.id, role: user.role } as const;
    const events = await withContext(pool, context, (db) => listEvents(db, {})).catch(() => []);
    const rooms = await Promise.all(events.map(async (event) => {
      const role = await withContext(pool, context, (db) => eventRole(db, event.id)).catch(() => 'client' as const);
      return role === 'pm' || role === 'am' || role === 'member' ? [`event:${event.id}`, `event-member:${event.id}`] : [`event:${event.id}`];
    }));
    // 연결 처리 중 연결이 끊겼다면 방에 넣지 않는다.
    if (socket.disconnected) return;
    socket.join(rooms.flat());
    socket.join(`user:${user.id}`);
    // 전체 공지 방. 내부 직원만 이 방에 들어온다.
    socket.join('workspace');
    socket.data.user = { userId: user.id, role: user.role };
  });

  return {
    http,
    io,
    listen: (port = config.port) => new Promise((resolve) => http.listen(port, () => resolve((http.address() as { port: number }).port))),
    close: () => new Promise((resolve) => void io.close(() => resolve())),
  };
}
