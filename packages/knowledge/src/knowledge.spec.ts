import { describe, expect, it } from 'vitest';
import { chunkDocument, chunkMarkdown, makeSnippet, mergeRanked, queryTerms, stripParticle, toTsQuery } from './index';

describe('chunkMarkdown', () => {
  it('제목 경로를 붙여 절 단위로 나눈다', () => {
    const chunks = chunkMarkdown('머리말\n\n# 행사\n개요\n\n## 일정\n3월 13일 시작');
    expect(chunks.map((c) => [c.heading, c.content])).toEqual([
      ['', '머리말'],
      ['행사', '개요'],
      ['행사 > 일정', '3월 13일 시작'],
    ]);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
  });
  it('긴 절은 문단 경계에서 나누고 코드 펜스 안의 #는 제목이 아니다', () => {
    const para = '가'.repeat(500);
    const chunks = chunkMarkdown(`# A\n${para}\n\n${para}\n\n\`\`\`\n# 주석\n\`\`\``, { maxChars: 800 });
    expect(chunks).toHaveLength(2);
    expect(chunks.every((c) => c.heading === 'A')).toBe(true);
    expect(chunks[1]!.content).toContain('# 주석');
  });
  it('빈 문서는 청크가 없다', () => {
    expect(chunkMarkdown('  \n\n')).toEqual([]);
  });
});

describe('queryTerms', () => {
  it('조사를 떼고 불용어·중복을 없앤다 (동사 어미는 접두 일치로 어형 변화를 흡수한다)', () => {
    expect(queryTerms('행사를 준비하는 담당자에게 일정이 공유되었나요')).toEqual(['행사', '준비하', '담당자', '일정', '공유되었나요']);
    expect(queryTerms('고객사 행사에서의 디자인 요청, 행사')).toEqual(['고객사', '행사', '디자인', '요청']);
  });
  it('어간이 2자 미만이 되면 조사를 떼지 않는다', () => {
    expect(stripParticle('나라')).toBe('나라');
    expect(stripParticle('이가')).toBe('이가');
    expect(stripParticle('연차를')).toBe('연차');
  });
  it('영문·숫자는 그대로 두고 한 글자 한글은 버린다', () => {
    expect(queryTerms('MICE 3D 와 영상')).toEqual(['mice', '3d', '영상']);
    expect(queryTerms('ㅁ 가')).toEqual([]);
  });
  it('용어 수를 제한한다', () => {
    expect(queryTerms(Array.from({ length: 40 }, (_, i) => `단어${i}`).join(' '))).toHaveLength(12);
  });
});

describe('toTsQuery', () => {
  it('접두 일치 OR 질의를 만들고 따옴표를 이스케이프한다', () => {
    expect(toTsQuery(['행사', '디자인'])).toBe("'행사':* | '디자인':*");
    expect(toTsQuery(["a'b", 'c\\d'])).toBe("'a''b':* | 'c\\\\d':*");
    expect(toTsQuery([])).toBe('');
  });
});

describe('mergeRanked / makeSnippet', () => {
  it('두 목록에 모두 있는 항목이 앞선다', () => {
    const merged = mergeRanked([[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }, { id: 'b' }]], 3);
    expect(merged.map((m) => m.id)).toEqual(['b', 'a', 'c']);
    expect(mergeRanked([[{ id: 'a' }, { id: 'b' }]], 1)).toHaveLength(1);
  });
  it('용어 주변을 잘라 보여준다', () => {
    const text = `${'앞'.repeat(300)} 행사 일정은 3월 ${'뒤'.repeat(300)}`;
    const s = makeSnippet(text, ['행사']);
    expect(s).toContain('행사');
    expect(s.startsWith('…')).toBe(true);
    expect(makeSnippet('짧은 글', ['없음'])).toBe('짧은 글');
  });
});

describe('chunkDocument', () => {
  it('제목을 모든 청크의 제목 경로 앞에 붙이고 본문이 비어도 제목 청크를 남긴다', () => {
    expect(chunkDocument({ title: '회의록', bodyMd: '# 일정\n3월' }).map((c) => c.heading)).toEqual(['회의록 > 일정']);
    expect(chunkDocument({ title: '회의록', bodyMd: '' })).toEqual([{ index: 0, heading: '회의록', content: '회의록' }]);
  });
});
