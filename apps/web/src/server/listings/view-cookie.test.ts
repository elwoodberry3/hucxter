import { describe, expect, it } from 'vitest';
import { countableView, newViewId, nextUtcMidnight, validViewId } from './view-cookie';

describe('hx_vid', () => {
  it('expires at the next UTC midnight', () => {
    expect(nextUtcMidnight(new Date('2026-11-06T23:59:59Z')).toISOString()).toBe(
      '2026-11-07T00:00:00.000Z',
    );
    expect(nextUtcMidnight(new Date('2026-12-31T00:00:00Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('is 128 random bits, base64url', () => {
    const a = newViewId();
    expect(validViewId(a)).toBe(true);
    expect(a).not.toBe(newViewId());
    expect(validViewId('short')).toBe(false);
    expect(validViewId(undefined)).toBe(false);
  });
});

describe('countable views (Brief 03C.1b H3)', () => {
  it('counts only same-origin page loads', () => {
    expect(countableView(new Headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(countableView(new Headers({ 'sec-fetch-site': 'same-site' }))).toBe(false);
    expect(countableView(new Headers({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(countableView(new Headers({ 'sec-fetch-site': 'none' }))).toBe(false);
    expect(countableView(new Headers())).toBe(false);
  });
});
