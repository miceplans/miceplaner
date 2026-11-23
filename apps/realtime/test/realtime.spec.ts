import { SignJWT } from 'jose';
import { io as connectClient, type Socket } from 'socket.io-client';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import { createPool, type Pool } from '@miceplans/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRealtimeServer } from '../src/server';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(4011), member: id(4013), staff: id(4014), client: id(4015) };
const EVENT = id(4101);
const CO = id(4201);

let admin: TestAdmin;
let pool: Pool;
let server: ReturnType<typeof createRealtimeServer>;
let base: string;
const tokens: Record<string, string> = {};
const sockets: Socket[] = [];
const sign = (sub: string, role: string) => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
const emit = (payload: unknown, secret: string | null = 'internal-test-secret') =>
  fetch(`${base}/internal/emit`, { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-internal-secret': secret } : {}) }, body: JSON.stringify(payload) });
const open = async (token: string) => {
  const socket = connectClient(base, { auth: { token }, transports: ['websocket'], reconnection: false });
  sockets.push(socket);
  await new Promise<void>((resolve) => { socket.on('connect', () => resolve()); socket.on('disconnect', () => resolve()); });
  return socket;
};
const settle = () => new Promise((r) => setTimeout(r, 300));
const received = (socket: Socket, name: string) => { const got: unknown[] = []; socket.on(name, (p) => got.push(p)); return got; };

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  for (const [name, uid] of Object.entries(U)) await admin.query(`INSERT INTO users (id, name, email, role) VALUES ($1, $2, 'rt-' || $2 || '@x.test', $3)`, [uid, name, name === 'client' ? 'client' : 'staff']);
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '실시간 고객사')`, [CO]);
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date) VALUES ($1, $2, 'rt-event', '2026-03-13', '2026-03-16')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members VALUES ($1,$2,'pm'), ($1,$3,'member')`, [EVENT, U.pm, U.member]);
  for (const [name, uid] of Object.entries(U)) tokens[name] = await sign(uid, name === 'client' ? 'client' : 'staff');
  pool = createPool(process.env.DATABASE_URL!);
  server = createRealtimeServer(pool);
  base = `http://127.0.0.1:${await server.listen(0)}`;
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await server.close();
  await pool.end();
  await admin.end();
});

describe('Socket.IO 서비스', () => {
  it('health 응답을 준다', async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });
  it('Client·잘못된 토큰은 연결이 끊긴다', async () => {
    for (const token of [tokens.client!, 'garbage']) {
      const socket = await open(token);
      await settle();
      expect(socket.connected).toBe(false);
    }
  });
  it('직원은 연결되고 행사 변경 푸시를 받는다', async () => {
    const socket = await open(tokens.staff!);
    const got = received(socket, 'event.changed');
    await settle();
    expect(socket.connected).toBe(true);
    expect((await emit({ type: 'event.changed', eventId: EVENT })).status).toBe(204);
    await settle();
    expect(got).toEqual([{ eventId: EVENT }]);
  });
  it('알림은 해당 사용자에게만 간다', async () => {
    const pm = await open(tokens.pm!);
    const staff = await open(tokens.staff!);
    const pmGot = received(pm, 'notification.new');
    const staffGot = received(staff, 'notification.new');
    await settle();
    await emit({ type: 'notification.new', userId: U.pm });
    await settle();
    expect(pmGot).toHaveLength(1);
    expect(staffGot).toHaveLength(0);
  });
  it('권한 회수 푸시는 통지하고 멤버 방에서 내보낸다', async () => {
    const member = await open(tokens.member!);
    const revoked = received(member, 'event.member-access.revoked');
    await settle();
    expect([...(await server.io.in(`user:${U.member}`).fetchSockets())].some((s) => s.rooms.has(`event-member:${EVENT}`))).toBe(true);
    await emit({ type: 'member-access.revoked', eventId: EVENT, userId: U.member });
    await settle();
    expect(revoked).toEqual([{ eventId: EVENT }]);
    expect([...(await server.io.in(`user:${U.member}`).fetchSockets())].some((s) => s.rooms.has(`event-member:${EVENT}`))).toBe(false);
    await emit({ type: 'member-access.granted', eventId: EVENT, userId: U.member });
    await settle();
    expect([...(await server.io.in(`user:${U.member}`).fetchSockets())].some((s) => s.rooms.has(`event-member:${EVENT}`))).toBe(true);
  });
  it('내부 푸시는 공유 비밀 없이는 거부하고 잘못된 본문은 400이다', async () => {
    expect((await emit({ type: 'event.changed', eventId: EVENT }, null)).status).toBe(403);
    expect((await emit({ type: 'event.changed', eventId: EVENT }, 'wrong')).status).toBe(403);
    expect((await emit({ type: 'event.changed', eventId: 'nope' })).status).toBe(400);
  });
});
