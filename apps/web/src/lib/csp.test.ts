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

  it('allows eval only in development', () => {
    expect(contentSecurityPolicy({ nonce: 'n', isDev: true, upgradeInsecure: false })).toContain(
      "'unsafe-eval'",
    );
  });

  it('creates distinct 128-bit base64 nonces', () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });
});
