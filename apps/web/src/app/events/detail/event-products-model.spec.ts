import { describe, expect, it } from 'vitest';
import { canRequest, missingFields, type RequestRow } from './event-products-model';

const row: RequestRow = { id: '1', name: '배너', part: '디자인', due: '', size: 'A1', qty: '', material: '천', vendor: '', contact: '', note: '', negotiating: false, status: 'draft' };

describe('디자인 요청 보내기', () => {
  it('품명·사이즈·재질이 비어 있으면 알려 준다', () => {
    expect(missingFields(row)).toEqual([]);
    expect(missingFields({ ...row, name: ' ', material: '' })).toEqual(['품명', '재질']);
  });
  it('작성 중이거나 반려된 요청만 보낼 수 있다', () => {
    expect((['draft', 'pending', 'success', 'reject'] as const).map((status) => canRequest({ ...row, status }))).toEqual([true, false, false, true]);
  });
});
