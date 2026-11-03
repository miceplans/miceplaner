/**
 * 목데이터 시드. 하이웍스 구성원을 그대로 가져와 사용자로 넣고, 비밀번호는 모두 `mice1170`으로 둔다.
 * 앱 역할은 RLS 때문에 쓸 수 없어, 마이그레이션과 같은 소유자 역할로 접속한다:
 * SEED_DATABASE_URL=postgres://postgres@127.0.0.1:54320/postgres pnpm --filter @miceplans/api seed
 */
import { createPool, seedMockData } from '@miceplans/db';
import { HiworksService } from '../src/auth/hiworks';
import { hashPassword } from '../src/auth/password';

const PASSWORD = 'mice1170';

if (!process.env.SEED_DATABASE_URL) throw new Error('SEED_DATABASE_URL이 필요하다 (마이그레이션 소유자 역할의 접속 문자열)');
const members = await new HiworksService().listMembers();
const pool = createPool(process.env.SEED_DATABASE_URL ?? '');
const client = await pool.connect();
try {
  const result = await seedMockData(client, members, await hashPassword(PASSWORD));
  console.log(`seed 완료: 사용자 ${result.users}명, 행사 ${result.events}건, 항목 ${result.items}건 (비밀번호 ${PASSWORD})`);
} finally {
  client.release();
  await pool.end();
}
