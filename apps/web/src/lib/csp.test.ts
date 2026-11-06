import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, createNonce } from './csp';

describe('contentSecurityPolicy', () => {
  it('locks down framing, objects and base URIs and carries the nonce', () => {
    const csp = contentSecurityPolicy({ nonce: 'abc', isDev: false, upgradeInsecure: true });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('unsafe-inline');
  });

  it('relaxes eval and inline styles only in development', () => {
    const csp = contentSecurityPolicy({ nonce: 'n', isDev: true, upgradeInsecure: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('allows Cloudflare Turnstile only when the captcha is on', () => {
    const off = contentSecurityPolicy({ nonce: 'n', isDev: false, upgradeInsecure: true });
    expect(off).not.toContain('challenges.cloudflare.com');
    expect(off).not.toContain('frame-src');
    const on = contentSecurityPolicy({
      nonce: 'n',
      isDev: false,
      upgradeInsecure: true,
      turnstile: true,
    });
    expect(on).toContain('frame-src https://challenges.cloudflare.com');
    expect(on).toContain("'strict-dynamic' https://challenges.cloudflare.com");
    expect(on).toContain("connect-src 'self'");
  });

  it('adds Mux hosts only when the Mux provider is on', () => {
    const base = { nonce: 'n', isDev: false, upgradeInsecure: true };
    const off = contentSecurityPolicy(base);
    expect(off).not.toContain('mux.com');
    expect(off).not.toContain('media-src');
    expect(off).not.toContain('worker-src');
    const on = contentSecurityPolicy({ ...base, mux: true });
    expect(on).toContain("connect-src 'self' https://*.mux.com https://storage.googleapis.com");
    expect(on).toContain("img-src 'self' data: blob: https://image.mux.com");
    expect(on).toContain("media-src 'self' blob: https://*.mux.com");
    expect(on).toContain("worker-src 'self' blob:");
    expect(on).toContain("style-src 'self' 'nonce-n'");
    expect(on).not.toContain('litix');
    expect(on).not.toContain('unsafe-inline');
  });

  it('creates distinct 128-bit base64 nonces', () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });
});
