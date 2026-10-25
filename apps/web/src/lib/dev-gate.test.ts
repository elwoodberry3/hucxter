import { describe, expect, it } from 'vitest';
import { devRoutesEnabled } from './dev-gate';

const prod = { NODE_ENV: 'production', APP_ORIGIN: 'https://hucxter.app' };

describe('devRoutesEnabled', () => {
  it('is off when APP_ENV=production', () => {
    expect(devRoutesEnabled({ ...prod, APP_ENV: 'production' })).toBe(false);
  });

  it('is off for a production build with APP_ENV unset (fail closed)', () => {
    expect(devRoutesEnabled(prod)).toBe(false);
  });

  it('is on for local and QA', () => {
    expect(devRoutesEnabled({ ...prod, APP_ENV: 'qa' })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: 'development' })).toBe(true);
  });
});
