import { describe, expect, it } from 'vitest';
import { searchEvents } from './search-events';

const ev = (id: string, name: string, startDate: string, over: object = {}) => ({ id, name, startDate, endDate: startDate, place: '', clientName: null, pmName: null, amName: null, ...over });

describe('searchEvents', () => {
  const events = [
    ev('1', '추계 학술대회', '2026-10-01', { place: '코엑스' }),
    ev('2', 'Expo 2026', '2026-12-01', { clientName: '학술재단' }),
    ev('3', '춘계 학술대회', '2026-04-01'),
  ];

  it('이름에 걸린 행사를 먼저, 같은 조건이면 최근 행사를 먼저 보여 준다', () => {
    expect(searchEvents(events, '학술').map((e) => e.id)).toEqual(['1', '3', '2']);
  });
  it('여러 단어는 모두 들어 있어야 하고 대소문자를 가리지 않는다', () => {
    expect(searchEvents(events, '학술대회 코엑스').map((e) => e.id)).toEqual(['1']);
    expect(searchEvents(events, 'expo').map((e) => e.id)).toEqual(['2']);
  });
  it('빈 검색어는 결과가 없다', () => {
    expect(searchEvents(events, '  ')).toEqual([]);
  });
});
