import { describe, expect, it } from 'vitest';
import { assertLocalSupabase, isE2eEmail } from './local-guard';

describe('assertLocalSupabase', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://127.0.0.1:54321/'])(
    'allows %s',
    (url) => {
      expect(() => assertLocalSupabase(url)).not.toThrow();
    },
  );

  it.each([
    undefined,
    '',
    'https://abcd.supabase.co',
    'https://127.0.0.1:54321',
    'http://127.0.0.2:54321',
    'http://localhost.evil.example:54321',
    'http://evil.example/?127.0.0.1',
    'http://user:pass@127.0.0.1:54321',
    'postgres://127.0.0.1:54322',
  ])('refuses %j', (url) => {
    expect(() => assertLocalSupabase(url)).toThrow();
  });
});

describe('isE2eEmail', () => {
  it('matches only the e2e domain', () => {
    expect(isE2eEmail('sam-1@e2e.hucxter.test')).toBe(true);
    expect(isE2eEmail('Sam-1@E2E.Hucxter.Test')).toBe(true);
    expect(isE2eEmail('sam@hucxter.app')).toBe(false);
    expect(isE2eEmail('sam@e2e.hucxter.test.evil.example')).toBe(false);
    expect(isE2eEmail('sam@evil.example@e2e.hucxter.test')).toBe(false);
    expect(isE2eEmail('e2e.hucxter.test')).toBe(false);
    expect(isE2eEmail(null)).toBe(false);
  });
});
