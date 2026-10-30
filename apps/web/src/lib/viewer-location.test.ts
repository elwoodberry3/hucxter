import { describe, expect, it } from 'vitest';
import { ipPostalCode, locationText } from './viewer-location';

const headersWith = (value: string | null) => ({ get: () => value });

describe('ipPostalCode', () => {
  it('trusts the Vercel header only on Vercel', () => {
    expect(ipPostalCode(headersWith('75009'), true)).toBe('75009');
    expect(ipPostalCode(headersWith('75009'), false)).toBeUndefined();
  });

  it('ignores malformed values', () => {
    for (const value of ['7500', '75009-1234', 'abcde', null]) {
      expect(ipPostalCode(headersWith(value), true)).toBeUndefined();
    }
  });
});

describe('locationText', () => {
  it('marks a guess with a question mark', () => {
    expect(
      locationText({
        zip: '75009',
        areaLabel: 'Celina',
        radiusMi: 25,
        isGuess: true,
        guessSource: 'ip',
      }),
    ).toBe('Near Celina 75009?');
    expect(
      locationText({
        zip: '75009',
        areaLabel: 'Celina',
        radiusMi: 25,
        isGuess: false,
        guessSource: null,
      }),
    ).toBe('Near Celina 75009');
    expect(locationText(null)).toBeNull();
  });
});
