import { describe, expect, it } from 'vitest';
import { guessMapping } from './fields';

describe('guessMapping', () => {
  it('does not mistake an event start-date header for the event name', () => {
    expect(guessMapping([
      { index: 0, label: '행사 시작일' },
      { index: 1, label: '행사명' },
    ])).toEqual({ 0: 'startDate', 1: 'name' });
  });
});
