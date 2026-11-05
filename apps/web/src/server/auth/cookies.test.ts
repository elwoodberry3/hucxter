import { describe, expect, it } from 'vitest';
import { authCookieOptions, hardenCookie } from './cookies';

describe('authCookieOptions', () => {
  it('is httpOnly and SameSite=Lax, and Secure over HTTPS', () => {
    expect(
      authCookieOptions({ isProduction: false, appOrigin: new URL('https://qa.hucxter.app') }),
    ).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
  });

  it('is Secure in production even if the origin says http', () => {
    expect(
      authCookieOptions({ isProduction: true, appOrigin: new URL('http://localhost:3101') }).secure,
    ).toBe(true);
  });

  it('is not Secure for plain-http local dev', () => {
    expect(
      authCookieOptions({ isProduction: false, appOrigin: new URL('http://localhost:3000') })
        .secure,
    ).toBe(false);
  });

  it('overrides the library defaults (httpOnly: false) on every write', () => {
    const base = authCookieOptions({ isProduction: true, appOrigin: new URL('https://x.app') });
    expect(hardenCookie({ httpOnly: false, sameSite: 'none', maxAge: 10 }, base)).toEqual({
      ...base,
      maxAge: 10,
    });
  });
});
