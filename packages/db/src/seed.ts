import type { PoolClient } from 'pg';

export type SeedUser = { name: string; email: string };

const ids = (prefix: string, n: number) => `00000000-0000-4000-${prefix}-${String(n).padStart(12, '0')}`;

/**
 * 개발용 목데이터. 마이그레이션 소유자 역할로 한 번만 실행하는 도구이며 앱 런타임에서는 쓰지 않는다.
 * 사용자는 하이웍스 구성원 그대로 넣고 비밀번호 해시는 모두 같은 값으로 둔다. 여러 번 실행해도 같은 결과다.
 */
export async function seedMockData(client: PoolClient, users: SeedUser[], passwordHash: string): Promise<{ users: number; events: number; items: number }> {
  await client.query('BEGIN');
  try {
    const userIds: string[] = [];
    for (const u of users) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash RETURNING id`,
        [u.name, u.email, passwordHash],
      );
      userIds.push(rows[0]!.id);
    }
    const u = (i: number) => userIds[i % userIds.length]!;

    const clients = ['삼성전자', '현대자동차', '부산관광공사', '한국무역협회', '네이버', '롯데호텔'];
    for (const [i, name] of clients.entries()) {
      await client.query(`INSERT INTO clients (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [ids('a000', i + 1), name]);
    }

    // [이름, 시작, 끝, 장소, 상태, 우선, 고객사 인덱스]
    const events: [string, string, string, string, string, boolean, number][] = [
      ['삼성전자 글로벌 파트너 컨퍼런스', '2026-11-18', '2026-11-20', '벡스코 제1전시장', '진행중', true, 0],
      ['현대자동차 신차 발표회', '2026-11-27', '2026-11-27', '킨텍스 3홀', '진행중', false, 1],
      ['부산국제관광박람회', '2026-12-10', '2026-12-13', '벡스코 오션홀', '확인중', false, 2],
      ['무역의 날 기념 세미나', '2026-12-05', '2026-12-05', '코엑스 그랜드볼룸', '제출', false, 3],
      ['네이버 개발자 데이 2026', '2026-10-22', '2026-10-23', '그랑서울 라운지', '성공', false, 4],
      ['롯데호텔 송년 갈라 디너', '2026-12-19', '2026-12-19', '롯데호텔 서울 크리스탈볼룸', '보류중', false, 5],
    ];
    for (const [i, e] of events.entries()) {
      await client.query(
        `INSERT INTO events (id, client_id, name, start_date, end_date, place, status, priority, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [ids('b000', i + 1), ids('a000', e[6] + 1), e[0], e[1], e[2], e[3], e[4], e[5], u(0)],
      );
      // PM 1명, AM 1명, 멤버 3명을 돌려가며 배정한다.
      const members: [number, string][] = [[i * 3, 'pm'], [i * 3 + 1, 'am'], [i * 3 + 2, 'member'], [i * 3 + 3, 'member'], [i * 3 + 4, 'member']];
      for (const [idx, role] of members) {
        await client.query(`INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [ids('b000', i + 1), u(idx), role]);
      }
    }

    // 행사마다 Program 3개, 각 Program에 Task 2개, 첫 Task에 Subtask 1개.
    const programs: [string, '디자인' | '영상' | '3D' | null][] = [['메인 무대·세트 디자인', '3D'], ['키비주얼·인쇄물 제작', '디자인'], ['오프닝·스케치 영상', '영상']];
    const tasks = ['시안 작성', '고객 검토 반영'];
    const statuses = ['할 일', '진행 중', '검토 대기', '완료'];
    // 담당자는 행사 멤버여야 하므로 위에서 배정한 5명 안에서 고른다.
    const member = (ei: number, k: number) => u(ei * 3 + (k % 5));
    let items = 0;
    for (const [ei, e] of events.entries()) {
      const eventId = ids('b000', ei + 1);
      const start = new Date(`${e[1]}T00:00:00Z`);
      const day = (offset: number) => new Date(start.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
      for (const [pi, [title, part]] of programs.entries()) {
        const base = ei * 100 + pi * 10;
        const programId = ids('c000', base + 1);
        const insert = (id: string, kind: string, parent: string | null, t: string, status: string, due: string, assignee: string, visible: boolean) =>
          client.query(
            `INSERT INTO event_items (id, event_id, kind, parent_id, title, part, status, due_on, assignee_id, client_visible, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
            [id, eventId, kind, parent, t, part, status, due, assignee, visible, u(0)],
          );
        await insert(programId, 'program', null, title, statuses[(ei + pi) % 4]!, day(-14 - pi * 3), member(ei, pi), pi === 1);
        items += 1;
        for (const [ti, t] of tasks.entries()) {
          const taskId = ids('c000', base + 2 + ti * 2);
          await insert(taskId, 'task', programId, `${title} - ${t}`, statuses[(ei + pi + ti) % 4]!, day(-10 - pi * 3 + ti * 3), member(ei, pi + ti + 1), false);
          items += 1;
          if (ti === 0) {
            await insert(ids('c000', base + 3), 'subtask', taskId, `${t} 내부 리뷰`, statuses[(ei + pi + 1) % 4]!, day(-9 - pi * 3), member(ei, pi + 2), false);
            items += 1;
          }
        }
      }
    }

    // 휴가 몇 건 (평일만, 같은 사용자·날짜·종류 중복 없음).
    const leaves: [number, string, string, number][] = [[1, '2026-11-09', 'full', 1], [2, '2026-11-12', 'am-half', 0.5], [3, '2026-11-16', 'pm-half', 0.5], [4, '2026-11-23', 'full', 1]];
    for (const [ui, date, kind, days] of leaves) {
      await client.query(
        `INSERT INTO leave_requests (user_id, leave_date, kind, days) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [u(ui), date, kind, days],
      );
    }
    await client.query('COMMIT');
    return { users: users.length, events: events.length, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
