import { describe, expect, it } from 'vitest';
import { maskPhone } from './phone-mask';

describe('maskPhone', () => {
  it('shows only the area code and last three digits', () => {
    expect(maskPhone('15039859742')).toBe('+1 (503) •••-•742');
    expect(maskPhone('+1 503-985-9742')).toBe('+1 (503) •••-•742');
    expect(maskPhone('5039859742')).toBe('+1 (503) •••-•742');
    expect(maskPhone('15039859742')).not.toContain('985');
  });
  it('returns null for anything that is not a US number', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone('')).toBeNull();
    expect(maskPhone('447700900123')).toBeNull();
  });
});
