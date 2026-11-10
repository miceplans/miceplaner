import { describe, expect, it } from 'vitest';
import { PersonNameMasker } from './privacy';

describe('PersonNameMasker', () => {
  it('masks known people, removes budgets, and restores names only for the viewer', () => {
    const masker = new PersonNameMasker(['김민수', '김민']);
    const sent = masker.redactText('김민수 담당.');
    expect(sent).toContain('<PERSON_001>');
    expect(sent).not.toContain('김민수');
    expect(masker.redactText('예산 1,200만원\n다음 일정은 5월입니다.')).toBe('[REDACTED_BUDGET]');
    expect(masker.restoreText('<PERSON_001>에게 확인했습니다.')).toBe('김민수에게 확인했습니다.');
  });

  it('keeps a split alias buffered until it can be restored', () => {
    const restorer = new PersonNameMasker(['김민수']).createStreamRestorer();
    expect(restorer.push('담당자는 <PERS')).toBe('담당자는 ');
    expect(restorer.push('ON_001>입니다')).toBe('김민수입니다');
    expect(restorer.flush()).toBe('');
  });

  it('never exposes a budget object value to the model', () => {
    const redacted = new PersonNameMasker([]).redact({ budget: 1_000_000, name: '행사' });
    expect(redacted).toEqual({ budget: '[REDACTED_BUDGET]', name: '행사' });
  });
});
