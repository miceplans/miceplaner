import { describe, expect, it } from 'vitest';
import { cellText } from './excel';

describe('cellText', () => {
  it('수식 결과·하이퍼링크·리치텍스트·오류값을 문자열로 푼다', () => {
    expect(cellText({ formula: 'A1', result: '코엑스' })).toBe('코엑스');
    expect(cellText({ text: '링크', hyperlink: 'https://x.test' })).toBe('링크');
    expect(cellText({ text: { richText: [{ text: '가' }, { text: '나' }] }, hyperlink: 'x' })).toBe('가나');
    expect(cellText({ richText: [{ text: '다' }, { text: '라' }] })).toBe('다라');
    expect(cellText({ error: '#N/A' })).toBe('');
  });
  it('숫자 부동소수 잡음과 불리언, 날짜를 다룬다', () => {
    expect(cellText(0.1 + 0.2)).toBe('0.3');
    expect(cellText(45292)).toBe('45292');
    expect(cellText(true)).toBe('TRUE');
    expect(cellText(new Date(Date.UTC(2025, 2, 6)))).toBe('2025-03-06');
    expect(cellText('  값 ')).toBe('값');
  });
});
