import { describe, expect, it } from 'vitest';
import { cronAuthorized } from './cron-auth';

const SECRET = 'c'.repeat(40);

describe('cron authorization (constant-time)', () => {
  it('accepts exactly "Bearer <CRON_SECRET>"', () => {
    expect(cronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it('rejects wrong, missing, and different-length values', () => {
    expect(cronAuthorized(`Bearer ${'d'.repeat(40)}`, SECRET)).toBe(false);
    expect(cronAuthorized(null, SECRET)).toBe(false);
    expect(cronAuthorized('', SECRET)).toBe(false);
    expect(cronAuthorized(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(cronAuthorized(`Bearer ${SECRET.slice(1)}`, SECRET)).toBe(false);
    expect(cronAuthorized(SECRET, SECRET)).toBe(false);
  });

  it('fails closed when CRON_SECRET is unset or short', () => {
    expect(cronAuthorized('Bearer ', undefined)).toBe(false);
    expect(cronAuthorized('Bearer short', 'short')).toBe(false);
  });
});
