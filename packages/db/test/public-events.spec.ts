import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getEvent, publicEvents, setEventPublicVisibility, softDeleteEvent, updateEvent, withContext, type DbContext } from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(9601), am: id(9602), member: id(9603), staff: id(9604), client: id(9605) };
const CO = id(9701);
const EVENT = id(9801);
const HIDDEN = id(9802);

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { pm: ctx(U.pm, 'staff'), am: ctx(U.am, 'staff'), member: ctx(U.member, 'staff'), staff: ctx(U.staff, 'staff'), client: ctx(U.client, 'client') };
/** API가 로그인 전 공개 조회에 쓰는 익명 컨텍스트. */
const anonymous: DbContext = { workspaceId: 'w1', userId: '', role: 'client' };

let app: pg.Pool;
let admin: pg.Pool;

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1, '공개PM', 'pub-pm@x.test', 'staff'), ($2, '공개AM', 'pub-am@x.test', 'staff'),
       ($3, '공개멤버', 'pub-member@x.test', 'staff'), ($4, '공개직원', 'pub-staff@x.test', 'staff'), ($5, '공개고객', 'pub-client@x.test', 'client')`,
    [U.pm, U.am, U.member, U.staff, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '공개 테스트사')`, [CO]);
  await admin.query(
    `INSERT INTO events (id, client_id, name, start_date, end_date, place) VALUES ($1, $3, '공개 행사', '2026-12-10', '2026-12-12', '비밀 장소'), ($2, $3, '비공개 행사', '2026-12-01', '2026-12-02', '')`,
    [EVENT, HIDDEN, CO],
  );
  await admin.query(`INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, 'pm'), ($1, $3, 'am'), ($1, $4, 'member')`, [EVENT, U.pm, U.am, U.member]);
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

const mine = (rows: { eventId: string }[]) => rows.filter((r) => r.eventId === EVENT || r.eventId === HIDDEN);

describe('비로그인 공개 캘린더 (F-07)', () => {
  it('행사는 기본 비공개라 익명 조회에 나오지 않는다', async () => {
    expect(mine(await withContext(app, anonymous, (db) => publicEvents(db)))).toEqual([]);
  });

  it('일반 멤버와 비멤버 직원은 공개 상태를 바꿀 수 없다 (DB 트리거)', async () => {
    const version = (await withContext(app, as.pm, (db) => getEvent(db, EVENT)))!.version;
    await expect(withContext(app, as.member, (db) => setEventPublicVisibility(db, U.member, EVENT, true, version))).rejects.toMatchObject({ code: '42501' });
    // 비멤버는 events_update RLS에 걸려 갱신 행이 없다.
    expect(await withContext(app, as.staff, (db) => setEventPublicVisibility(db, U.staff, EVENT, true, version))).not.toMatchObject({ publicVisible: true });
  });

  it('PM이 공개하면 익명 조회에 행사명·기간만 나오고 감사 로그를 남긴다', async () => {
    const version = (await withContext(app, as.pm, (db) => getEvent(db, EVENT)))!.version;
    const row = await withContext(app, as.pm, (db) => setEventPublicVisibility(db, U.pm, EVENT, true, version));
    expect(row).toMatchObject({ id: EVENT, publicVisible: true, version: version + 1 });
    expect(mine(await withContext(app, anonymous, (db) => publicEvents(db)))).toEqual([{ eventId: EVENT, name: '공개 행사', startDate: '2026-12-10', endDate: '2026-12-12' }]);
    const log = await admin.query(`SELECT actor_id, detail FROM audit_log WHERE action = 'event.public_visibility.change' AND event_id = $1`, [EVENT]);
    expect(log.rows).toEqual([{ actor_id: U.pm, detail: { publicVisible: true } }]);
  });

  it('본 version이 다르면 충돌로 돌려주고 바꾸지 않는다', async () => {
    const current = (await withContext(app, as.am, (db) => getEvent(db, EVENT)))!;
    expect(await withContext(app, as.am, (db) => setEventPublicVisibility(db, U.am, EVENT, false, current.version - 1))).toBe('conflict');
    expect((await withContext(app, as.am, (db) => getEvent(db, EVENT)))!.publicVisible).toBe(true);
  });

  it('일반 필드 수정은 멤버도 하되 공개 상태는 유지된다', async () => {
    const row = await withContext(app, as.member, (db) => updateEvent(db, EVENT, { place: '바뀐 장소' }));
    expect(row).toMatchObject({ publicVisible: true, place: '바뀐 장소' });
  });

  it('Client 컨텍스트로도 공개 행사만 보이며, 삭제된 행사는 사라진다', async () => {
    expect(mine(await withContext(app, as.client, (db) => publicEvents(db))).map((r) => r.eventId)).toEqual([EVENT]);
    expect(await withContext(app, as.pm, (db) => softDeleteEvent(db, U.pm, EVENT))).toBe(true);
    expect(mine(await withContext(app, anonymous, (db) => publicEvents(db)))).toEqual([]);
  });
});
