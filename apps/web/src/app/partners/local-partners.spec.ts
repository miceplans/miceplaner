import { describe, expect, it } from 'vitest';
import { parseLocalPartners, samePartner } from './local-partners';

describe('parseLocalPartners', () => {
  it('저장 계약에 맞게 바꾸고 업체명이 없는 행과 예약된 태그는 버린다', () => {
    const out = parseLocalPartners(
      JSON.stringify(['디자인', '디자인', '전체', 3]),
      JSON.stringify([{ id: 'p1', name: ' 가나인쇄 ', field: '디자인', phone: '02-1', events: '' }, { name: ' ' }, null]),
    );
    expect(out.fields).toEqual(['디자인']);
    expect(out.partners).toEqual([{ name: '가나인쇄', field: '디자인', manager: '', phone: '02-1', email: '', memo: '' }]);
  });
  it('깨진 값은 비어 있다', () => {
    expect(parseLocalPartners('{', null)).toEqual({ fields: [], partners: [] });
  });
});

describe('samePartner', () => {
  it('업체명과 연락처 숫자가 같으면 같은 협력사다', () => {
    expect(samePartner({ name: '가나인쇄', phone: '02-123' }, { name: ' 가나인쇄', phone: '02123' })).toBe(true);
    expect(samePartner({ name: '가나인쇄', phone: '02-123' }, { name: '가나인쇄', phone: '' })).toBe(false);
  });
});
