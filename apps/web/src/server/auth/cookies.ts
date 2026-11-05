import type { CookieOptions } from '@supabase/ssr';

/**
 * Session cookie flags (brief §5, hucxter-trust-safety): httpOnly so page scripts can't read the
 * tokens, SameSite=Lax, Secure whenever the app is served over HTTPS or in production. There is no
 * browser Supabase client, so nothing needs script access to these cookies.
 */
export function authCookieOptions({
  isProduction,
  appOrigin,
}: {
  isProduction: boolean;
  appOrigin: URL;
}): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction || appOrigin.protocol === 'https:',
    path: '/',
  };
}

/** Applies our flags over whatever @supabase/ssr passes for a cookie it writes. */
export function hardenCookie(options: CookieOptions, base: CookieOptions): CookieOptions {
  return { ...options, ...base };
}
