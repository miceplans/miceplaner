import { describe, expect, it } from 'vitest';
import { systemPrompt } from './prompts';

const ID = '00000000-0000-4000-8000-000000000001';

describe('systemPrompt', () => {
  it('보고 있는 행사의 id와 기본 정보를 맥락으로 넣는다', () => {
    const p = systemPrompt({ today: '2026-11-19', eventId: ID, event: { name: '추계 학술대회', startDate: '2026-12-01', endDate: '2026-12-02', place: '코엑스', status: 'ongoing' } });
    expect(p).toContain(ID);
    expect(p).toContain('추계 학술대회');
    expect(p).toContain('코엑스');
  });

  it('행사 맥락이 없으면 행사 문구를 넣지 않는다', () => {
    expect(systemPrompt({ today: '2026-11-19' })).not.toContain('detail page');
  });
});
