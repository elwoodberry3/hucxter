import { describe, expect, it } from 'vitest';
import { serverConfig } from './env';

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
});
