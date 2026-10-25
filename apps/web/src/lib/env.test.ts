import { describe, expect, it } from 'vitest';
import { serverConfig, supabaseConfig } from './env';

describe('serverConfig', () => {
  it('defaults the origin in development', () => {
    expect(serverConfig({ NODE_ENV: 'development' }).appOrigin.origin).toBe(
      'http://localhost:3000',
    );
  });

  it('requires APP_ORIGIN in production', () => {
    expect(() => serverConfig({ NODE_ENV: 'production' })).toThrow(/APP_ORIGIN/);
  });

  it('rejects a non-http origin', () => {
    expect(() =>
      serverConfig({ NODE_ENV: 'production', APP_ORIGIN: 'javascript:alert(1)' }),
    ).toThrow();
  });

  it('rejects values that are not a bare origin', () => {
    for (const APP_ORIGIN of [
      'https://user:pass@hucxter.app',
      'https://hucxter.app/path',
      'https://hucxter.app?x=1',
    ]) {
      expect(() => serverConfig({ APP_ORIGIN }), APP_ORIGIN).toThrow(/origin/);
    }
    expect(serverConfig({ APP_ORIGIN: 'https://hucxter.app/' }).appOrigin.origin).toBe(
      'https://hucxter.app',
    );
  });

  it('prefers GIT_COMMIT_SHA, then VERCEL_GIT_COMMIT_SHA, then "unknown"', () => {
    expect(serverConfig({ GIT_COMMIT_SHA: 'a', VERCEL_GIT_COMMIT_SHA: 'b' }).commit).toBe('a');
    expect(serverConfig({ GIT_COMMIT_SHA: '', VERCEL_GIT_COMMIT_SHA: 'b' }).commit).toBe('b');
    expect(serverConfig({}).commit).toBe('unknown');
  });

  it('treats a production build without APP_ENV as production (fail closed)', () => {
    const base = { NODE_ENV: 'production', APP_ORIGIN: 'https://hucxter.app' };
    expect(serverConfig(base).appEnv).toBe('production');
    expect(serverConfig(base).isProduction).toBe(true);
    expect(serverConfig({ ...base, APP_ENV: 'qa' }).isProduction).toBe(false);
    expect(serverConfig({ NODE_ENV: 'development' }).appEnv).toBe('local');
  });

  it('rejects unknown APP_ENV values', () => {
    expect(() => serverConfig({ APP_ENV: 'staging' })).toThrow();
  });

  it('trusts Vercel IP headers only on Vercel', () => {
    expect(serverConfig({}).isVercel).toBe(false);
    expect(serverConfig({ VERCEL: '1' }).isVercel).toBe(true);
  });

  it('validates DEFAULT_AREA_ZIP', () => {
    expect(serverConfig({ DEFAULT_AREA_ZIP: '75009' }).defaultAreaZip).toBe('75009');
    expect(() => serverConfig({ DEFAULT_AREA_ZIP: '7500' })).toThrow();
  });
});

describe('supabaseConfig', () => {
  it('requires URL and publishable key', () => {
    expect(() => supabaseConfig({})).toThrow(/SUPABASE_URL/);
    expect(
      supabaseConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_PUBLISHABLE_KEY: 'k' }),
    ).toEqual({ url: 'http://127.0.0.1:54321', publishableKey: 'k' });
  });
});
