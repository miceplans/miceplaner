import type { EventListItemDto } from '@miceplans/contracts';

type Searchable = Pick<EventListItemDto, 'id' | 'name' | 'startDate' | 'endDate' | 'place' | 'clientName' | 'pmName' | 'amName'>;

/** 행사명·고객사·장소·PM·AM에 검색어의 모든 단어가 들어 있는 행사. 이름에 걸린 행사를 먼저, 그 안에서는 최근 행사를 먼저 둔다. */
export function searchEvents<T extends Searchable>(events: readonly T[], query: string, limit = 8): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const inName = (e: T) => words.every((w) => e.name.toLowerCase().includes(w));
  return events
    .filter((e) => {
      const text = [e.name, e.clientName, e.place, e.pmName, e.amName].filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => Number(inName(b)) - Number(inName(a)) || b.startDate.localeCompare(a.startDate))
    .slice(0, limit);
}
