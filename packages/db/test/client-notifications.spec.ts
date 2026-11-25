import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getItem, listNotifications, markPortalNotificationsRead, portalNotifications, rescheduleItem, setClientVisible, softDeleteItem, updateItem, withContext, type DbContext } from '../src';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { pm: id(8801), direct: id(8802), byCompany: id(8803), outsider: id(8804) };
const CO = id(8811);
const EVENT = id(8821);
const P = { shown: id(8831), hidden: id(8832), task: id(8833) };

const ctx = (userId: string, role: DbContext['role']): DbContext => ({ workspaceId: 'w1', userId, role });
const as = { pm: ctx(U.pm, 'staff'), direct: ctx(U.direct, 'client'), byCompany: ctx(U.byCompany, 'client'), outsider: ctx(U.outsider, 'client') };

let app: pg.Pool;
let admin: pg.Pool;

const inbox = (who: DbContext) => withContext(app, who, (db) => portalNotifications(db));
const version = async (item: string) => (await withContext(app, as.pm, (db) => getItem(db, item)))!.version;
const reveal = async (item: string, visible: boolean) => {
  const v = await version(item);
  return withContext(app, as.pm, (db) => setClientVisible(db, U.pm, item, visible, v));
};
const move = async (item: string, startsOn: string | null, dueOn: string | null) => {
  const v = await version(item);
  return withContext(app, as.pm, (db) => rescheduleItem(db, item, startsOn, dueOn, v));
};

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: process.env.TEST_PG_ADMIN_URL });
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '알림 테스트사')`, [CO]);
  await admin.query(
    `INSERT INTO users (id, name, email, role, client_id) VALUES ($1, '알림PM', 'cn-pm@x.test', 'staff', NULL), ($2, '지정고객', 'cn-direct@x.test', 'client', NULL),
       ($3, '소속고객', 'cn-company@x.test', 'client', $5), ($4, '무관고객', 'cn-out@x.test', 'client', NULL)`,
    [U.pm, U.direct, U.byCompany, U.outsider, CO],
  );
  await admin.query(`INSERT INTO events (id, client_id, name, start_date, end_date, place) VALUES ($1, $2, '알림 행사', '2026-12-10', '2026-12-12', '')`, [EVENT, CO]);
  await admin.query(`INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, 'pm')`, [EVENT, U.pm]);
  await admin.query(`INSERT INTO event_clients (event_id, client_user_id) VALUES ($1, $2)`, [EVENT, U.direct]);
  await admin.query(
    `INSERT INTO event_items (id, event_id, kind, parent_id, title, starts_on, due_on, assignee_id, created_by) VALUES
       ($1, $4, 'program', NULL, '개막식', '2026-12-10', '2026-12-10', $5, $5), ($2, $4, 'program', NULL, '내부 회의', '2026-12-01', NULL, NULL, $5),
       ($3, $4, 'task', $1, '무대 설치', '2026-12-09', '2026-12-09', NULL, $5)`,
    [P.shown, P.hidden, P.task, EVENT, U.pm],
  );
  app = new pg.Pool({ connectionString: process.env.TEST_PG_APP_URL });
});
afterAll(async () => { await app.end(); await admin.end(); });

describe('Client 알림함 (F-06·F-07)', () => {
  it('비공개 Program과 Task의 일정 변경은 알림을 만들지 않는다', async () => {
    await move(P.hidden, '2026-12-02', null);
    await move(P.task, '2026-12-08', '2026-12-09');
    expect(await inbox(as.direct)).toEqual([]);
    expect((await admin.query(`SELECT count(*)::int AS n FROM client_notifications WHERE event_id = $1`, [EVENT])).rows[0].n).toBe(0);
  });

  it('공개하면 지정 Client와 소속 고객사 Client에게만 알림이 보이고 내부 정보는 담지 않는다', async () => {
    await reveal(P.shown, true);
    const rows = await inbox(as.direct);
    expect(rows).toEqual([
      { id: expect.any(Number), kind: 'program_published', eventId: EVENT, eventName: '알림 행사', programId: P.shown, programTitle: '개막식', beforeStartsOn: null, beforeDueOn: null, afterStartsOn: '2026-12-10', afterDueOn: '2026-12-10', createdAt: expect.any(String), readAt: null },
    ]);
    expect(await inbox(as.byCompany)).toEqual(rows);
    expect(await inbox(as.outsider)).toEqual([]);
    expect(await inbox(as.pm)).toEqual([]); // 내부 직원은 포털 함수로 볼 수 없다.
  });

  it('공개 Program의 일정 변경은 이전·변경 날짜를 남기고, 제목만 바꾸면 남기지 않는다', async () => {
    await move(P.shown, '2026-12-10', '2026-12-08').catch(() => undefined); // 마감이 시작보다 빠르면 DB가 거부한다.
    await move(P.shown, '2026-12-08', '2026-12-09');
    await withContext(app, as.pm, (db) => updateItem(db, P.shown, { startsOn: '2026-12-07' }));
    await withContext(app, as.pm, (db) => updateItem(db, P.shown, { title: '개막 행사', startsOn: '2026-12-07' }));
    const rows = await inbox(as.direct);
    expect(rows.map((r) => [r.kind, r.beforeStartsOn, r.beforeDueOn, r.afterStartsOn, r.afterDueOn])).toEqual([
      ['schedule_changed', '2026-12-08', '2026-12-09', '2026-12-07', '2026-12-09'],
      ['schedule_changed', '2026-12-10', '2026-12-10', '2026-12-08', '2026-12-09'],
      ['program_published', null, null, '2026-12-10', '2026-12-10'],
    ]);
    expect(rows[0]!.programTitle).toBe('개막 행사');
  });

  it('읽음은 Client별로 따로이고 볼 수 없는 알림은 바꾸지 못한다', async () => {
    const [latest] = await inbox(as.direct);
    expect(await withContext(app, as.outsider, (db) => markPortalNotificationsRead(db, [latest!.id]))).toBe(0);
    expect(await withContext(app, as.pm, (db) => markPortalNotificationsRead(db, [latest!.id]))).toBe(0);
    expect(await withContext(app, as.direct, (db) => markPortalNotificationsRead(db, [latest!.id]))).toBe(1);
    expect(await withContext(app, as.direct, (db) => markPortalNotificationsRead(db, [latest!.id]))).toBe(0);
    expect((await inbox(as.direct))[0]!.readAt).not.toBeNull();
    expect((await inbox(as.byCompany))[0]!.readAt).toBeNull();
  });

  it('애플리케이션 역할은 알림 표에 직접 접근하지 못한다', async () => {
    for (const who of [as.direct, as.pm]) {
      for (const table of ['client_notifications', 'client_notification_reads']) {
        await expect(withContext(app, who, (db) => db.query(`SELECT * FROM ${table}`))).rejects.toMatchObject({ code: '42501' });
      }
    }
    await expect(withContext(app, as.direct, (db) => db.query(`INSERT INTO client_notification_reads (notification_id, user_id) VALUES (1, $1)`, [U.byCompany]))).rejects.toMatchObject({ code: '42501' });
  });

  it('Client는 내부 알림 표를 여전히 볼 수 없다', async () => {
    expect(await withContext(app, as.direct, (db) => listNotifications(db))).toEqual([]);
  });

  it('30일이 지난 알림은 나오지 않는다', async () => {
    const [latest] = await inbox(as.direct);
    await admin.query(`UPDATE client_notifications SET created_at = now() - interval '31 days' WHERE id = $1`, [latest!.id]);
    expect((await inbox(as.direct)).map((r) => r.id)).not.toContain(latest!.id);
  });

  it('비공개로 바꾸거나 지정을 풀거나 삭제하면 지난 알림도 사라진다', async () => {
    await reveal(P.shown, false);
    expect(await inbox(as.direct)).toEqual([]);
    await reveal(P.shown, true);
    expect((await inbox(as.direct))[0]).toMatchObject({ kind: 'program_published' });
    await admin.query(`DELETE FROM event_clients WHERE event_id = $1`, [EVENT]);
    expect(await inbox(as.direct)).toEqual([]);
    expect(await inbox(as.byCompany)).not.toEqual([]);
    await withContext(app, as.pm, (db) => softDeleteItem(db, P.shown));
    expect(await inbox(as.byCompany)).toEqual([]);
  });
});
