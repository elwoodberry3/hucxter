import { describe, expect, it, vi } from 'vitest';
import { callbackRedirect } from './callback';
import type { CallbackDeps } from './callback';
import { CLOSED_TEST_MESSAGE } from './errors';

const ORIGIN = 'http://localhost:3100';

function deps(overrides: Partial<CallbackDeps> = {}) {
  return {
    exchange: vi.fn(() => Promise.resolve({ ok: true, closedTest: false })),
    member: vi.fn(() => Promise.resolve({ verified: false })),
    ...overrides,
  };
}

const url = (query: string) => new URL(`/auth/callback?${query}`, ORIGIN);

describe('Google callback', () => {
  it('sends a new member to /welcome with next', async () => {
    const d = deps();
    expect(await callbackRedirect(url('code=abc&next=%2Fsell'), d)).toBe('/welcome?next=%2Fsell');
    expect(d.exchange).toHaveBeenCalledWith('abc');
  });

  it('sends a verified member straight to next, or home', async () => {
    const d = deps({ member: () => Promise.resolve({ verified: true }) });
    expect(await callbackRedirect(url('code=abc&next=%2Fc%2Fhome'), d)).toBe('/c/home');
    expect(await callbackRedirect(url('code=abc'), d)).toBe('/');
  });

  it('fails without a code, with a malformed code, or when the exchange fails (e.g. missing PKCE verifier)', async () => {
    expect(await callbackRedirect(url('next=%2Fsell'), deps())).toBe(
      '/sign-in?error=failed&next=%2Fsell',
    );
    expect(await callbackRedirect(url('code=a%20b'), deps())).toBe('/sign-in?error=failed');
    const failing = deps({ exchange: () => Promise.resolve({ ok: false, closedTest: false }) });
    expect(await callbackRedirect(url('code=abc'), failing)).toBe('/sign-in?error=failed');
  });

  it('maps the invite-hook rejection to the closed-test screen (redirect error and exchange error)', async () => {
    const redirected = url(
      `error=server_error&error_code=unexpected_failure&error_description=${encodeURIComponent(CLOSED_TEST_MESSAGE)}`,
    );
    expect(await callbackRedirect(redirected, deps())).toBe('/sign-in?error=closed_test');
    const rejected = deps({ exchange: () => Promise.resolve({ ok: false, closedTest: true }) });
    expect(await callbackRedirect(url('code=abc'), rejected)).toBe('/sign-in?error=closed_test');
  });

  it('maps a cancelled Google consent to "cancelled" without exchanging', async () => {
    const d = deps();
    expect(await callbackRedirect(url('error=access_denied&next=%2Fsell'), d)).toBe(
      '/sign-in?error=cancelled&next=%2Fsell',
    );
    expect(d.exchange).not.toHaveBeenCalled();
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '%2F%2Fevil.example',
    '/%5Cevil.example',
    '/\\evil.example',
    '/welcome',
    '/auth/callback',
  ])('drops an unsafe next (%s)', async (next) => {
    const member = () => Promise.resolve({ verified: true });
    const target = await callbackRedirect(
      url(`code=abc&next=${encodeURIComponent(next)}`),
      deps({ member }),
    );
    expect(target).toBe('/');
    const failed = await callbackRedirect(url(`next=${encodeURIComponent(next)}`), deps());
    expect(failed).toBe('/sign-in?error=failed');
  });
});
