import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { contentSecurityPolicy, createNonce } from '@/lib/csp';
import { authConfig, mediaConfig, profileConfig, serverConfig, supabaseConfig } from '@/lib/env';
import { isProductPath } from '@/lib/routes';
import { authCookieOptions, hardenCookie } from '@/server/auth/cookies';
import { AUTH_COOKIE, isStaleAuthError } from '@/server/auth/stale-session';
import { logError } from '@/server/log';

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const captcha = authConfig().captcha;
  const csp = contentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    upgradeInsecure: isHttpsOrigin(process.env.APP_ORIGIN),
    turnstile: captcha.provider === 'turnstile',
    mux: mediaConfig().provider === 'mux',
    // Mux Player needs inline shadow-DOM styles; only listing pages load it.
    inlineStyles: isProductPath(request.nextUrl.pathname),
    avatarOrigin: profileConfig().avatarOrigin,
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const forward = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Content-Security-Policy', csp);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  let response = forward();
  if (hasAuthCookie(request)) response = await refreshSession(request, response, forward);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

/**
 * Refreshes an expiring Supabase session before Server Components render (they can't write
 * cookies). New cookies go on the forwarded request (for this render) and on the response (for
 * the browser), per @supabase/ssr's Next.js guidance. Guests (no auth cookie) skip this.
 */
async function refreshSession(
  request: NextRequest,
  initial: NextResponse,
  forward: () => NextResponse,
): Promise<NextResponse> {
  let response = initial;
  const { url, publishableKey } = supabaseConfig();
  const base = authCookieOptions(serverConfig());
  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: base,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = forward();
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, hardenCookie(options, base));
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  const { error } = await supabase.auth.getClaims();
  if (error !== null && isStaleAuthError(error)) {
    // Brief 03C.1b H5: an invalid session renders as a guest now (request) and is gone next time
    // (response). Outages and network errors keep the cookies.
    logError('stale_session_cleared', { status: error.status, code: error.code });
    const stale = request.cookies.getAll().filter(({ name }) => AUTH_COOKIE.test(name));
    for (const { name } of stale) request.cookies.delete(name);
    response = forward();
    for (const { name } of stale) {
      response.cookies.set(name, '', hardenCookie({ maxAge: 0 }, base));
    }
    // Like @supabase/ssr's own cookie writes: never let a shared cache keep this response.
    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate, max-age=0',
    );
  }
  return response;
}

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token/.test(name));
}

function isHttpsOrigin(value: string | undefined): boolean {
  if (value === undefined) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes (static CSP in next.config.ts), build output, and known static
      // asset types. Dotted page paths (e.g. /u/john.doe) still get the CSP.
      source:
        '/((?!api/|_next/static|_next/image|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|webmanifest|txt|xml|css|js|map|woff2?)$).*)',
      // RSC router prefetches are not documents. Browser document prefetches are not skipped.
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
