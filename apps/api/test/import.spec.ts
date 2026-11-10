import 'reflect-metadata';
import { SignJWT } from 'jose';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import { connectTestAdmin, type TestAdmin } from '@miceplans/db/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HiworksService } from '../src/auth/hiworks';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { importer: id(61), pm: id(62), client: id(63) };
const CO = id(211);

let app: INestApplication;
let http: Parameters<typeof request>[0];
let admin: TestAdmin;
const tokens: Record<string, string> = {};

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (sub: string, role = 'staff') => new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).sign(secret());
const as = (user: keyof typeof U) => ({ Authorization: `Bearer ${tokens[user]}` });
const api = () => request(http);

async function sampleXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('행사');
  ws.addRow(['행사명', '기간 · 시작', '기간 · 끝', '고객사', 'PM', '상태', '장소', '비고']);
  ws.addRow(['새 행사', '2025-03-06', '2025-03-08', '신규고객', 'PM', '진행중', '코엑스', '기타 내용']);
  ws.addRow(['', '2025-04-01', '2025-04-02', '고객사', 'PM', '진행중', '', '']);
  ws.addRow(['끝이 빠름', '2025-05-10', '2025-05-01', '고객사', '없는사람', '이상한상태', '', '']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

beforeAll(async () => {
  admin = await connectTestAdmin(process.env.TEST_PG_ADMIN_URL!);
  await admin.query(
    `INSERT INTO users (id, name, email, role) VALUES ($1,'가져오기','importer@x.test','staff'), ($2,'PM','pm-import@x.test','staff'), ($3,'Client','client-import@x.test','client')`,
    [U.importer, U.pm, U.client],
  );
  await admin.query(`INSERT INTO clients (id, name) VALUES ($1, '기존고객')`, [CO]);
  tokens.importer = await sign(U.importer);
  tokens.pm = await sign(U.pm);
  tokens.client = await sign(U.client, 'client');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(HiworksService)
    .useValue({ findMember: async () => undefined })
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  http = app.getHttpServer();
}, 120_000);

afterAll(async () => { await app.close(); await admin.end(); });

describe('Excel 일괄 가져오기', () => {
  it('업로드 → 시트 파싱 → 매핑·검증 → 실행까지 끝나고 원본이 지워진다', async () => {
    const uploaded = await api()
      .post('/import/excel')
      .set(as('importer'))
      .attach('file', await sampleXlsx(), { filename: 'events.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201);
    expect(uploaded.body).toMatchObject({ fileName: 'events.xlsx', status: 'uploaded' });
    expect(uploaded.body.sheets).toEqual([{ name: '행사', rowCount: 4 }]);
    const jobId: string = uploaded.body.id;

    const parsed = await api().post(`/import/${jobId}/parse`).set(as('importer')).send({ sheet: '행사', hasHeader: true, headerRow: 1 }).expect(201);
    expect(parsed.body.status).toBe('parsed');
    expect(parsed.body.columns).toHaveLength(8);
    expect(parsed.body.dataRowCount).toBe(3);

    const mapping = { 0: 'name', 1: 'startDate', 2: 'endDate', 3: 'client', 4: 'pm', 5: 'status', 6: 'place' };
    const previewed = await api().post(`/import/${jobId}/preview`).set(as('importer')).send({ mapping }).expect(201);
    expect(previewed.body.validation).toMatchObject({ total: 3, valid: 1, invalid: 2 });
    expect(previewed.body.validation.rows[0]).toMatchObject({ row: 2, name: '새 행사', ok: true });

    const executed = await api().post(`/import/${jobId}/execute`).set(as('importer')).expect(201);
    expect(executed.body.status).toBe('done');
    expect(executed.body.result.created).toBe(1);
    expect(executed.body.result.failed).toHaveLength(2);
    expect(executed.body.result.warnings.length).toBeGreaterThan(0);

    // 행사·고객사·멤버·위키가 만들어졌는지 본다.
    const event = await admin.query(`SELECT name, place, status, start_date::text AS s, end_date::text AS e FROM events WHERE name = '새 행사'`);
    expect(event.rows[0]).toMatchObject({ place: '코엑스', status: '진행중', s: '2025-03-06', e: '2025-03-08' });
    const members = await admin.query(`SELECT user_id, role FROM event_members WHERE event_id = (SELECT id FROM events WHERE name = '새 행사') ORDER BY role, user_id`);
    expect(members.rows).toEqual(expect.arrayContaining([{ user_id: U.importer, role: 'pm' }, { user_id: U.pm, role: 'pm' }]));
    const newClient = await admin.query(`SELECT id FROM clients WHERE name = '신규고객'`);
    expect(newClient.rowCount).toBe(1);
    const doc = await admin.query(`SELECT title, body_md FROM event_docs WHERE title = '새 행사'`);
    expect(doc.rowCount).toBe(1);
    expect(doc.rows[0].body_md).toContain('기타 내용'); // 매핑 안 한 컬럼도 위키에 남는다.

    // 원본 보관 정책: 처리 후 즉시 파기.
    const cleared = await admin.query(`SELECT file, rows, status FROM import_jobs WHERE id = $1`, [jobId]);
    expect(cleared.rows[0]).toMatchObject({ file: null, rows: null, status: 'done' });
  });

  it('같은 작업을 두 번 실행하면 409다', async () => {
    const uploaded = await api().post('/import/excel').set(as('importer')).attach('file', await sampleXlsx(), { filename: 'events.xlsx' }).expect(201);
    const jobId: string = uploaded.body.id;
    await api().post(`/import/${jobId}/parse`).set(as('importer')).send({ sheet: '행사', hasHeader: true, headerRow: 1 }).expect(201);
    await api().post(`/import/${jobId}/preview`).set(as('importer')).send({ mapping: { 0: 'name', 1: 'startDate', 3: 'client' } }).expect(201);
    await api().post(`/import/${jobId}/execute`).set(as('importer')).expect(201);
    await api().post(`/import/${jobId}/execute`).set(as('importer')).expect(409);
  });

  it('Client는 가져오기를 쓸 수 없고 토큰이 없으면 401이다', async () => {
    const buf = await sampleXlsx();
    await api().post('/import/excel').attach('file', buf, { filename: 'events.xlsx' }).expect(401);
    await api().post('/import/excel').set(as('client')).attach('file', buf, { filename: 'events.xlsx' }).expect(403);
  });

  it('행사명·시작일이 매핑에 없으면 400이다', async () => {
    const uploaded = await api().post('/import/excel').set(as('importer')).attach('file', await sampleXlsx(), { filename: 'events.xlsx' }).expect(201);
    const jobId: string = uploaded.body.id;
    await api().post(`/import/${jobId}/parse`).set(as('importer')).send({ sheet: '행사', hasHeader: true, headerRow: 1 }).expect(201);
    await api().post(`/import/${jobId}/preview`).set(as('importer')).send({ mapping: { 0: 'name' } }).expect(400);
  });
});
