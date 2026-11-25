import { describe, expect, it } from 'vitest';
import { parseLocalLeave } from './local-leave';

describe('parseLocalLeave', () => {
  it('날짜만 골라 중복 없이 정렬한다', () => {
    expect(
      parseLocalLeave(
        JSON.stringify(['2026-11-22', '2026-11-21', '2026-11-21', 3, 'x']),
        JSON.stringify([{ date: '2026-11-24', employeeId: 'me', kind: 'comp' }, null, {}]),
      ),
    ).toEqual({ weekendWork: ['2026-11-21', '2026-11-22'], comp: ['2026-11-24'] });
  });
  it('저장값이 없거나 깨졌으면 비어 있다', () => {
    expect(parseLocalLeave(null, '{')).toEqual({ weekendWork: [], comp: [] });
  });
});
