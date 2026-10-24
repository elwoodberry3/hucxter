import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { contentSecurityPolicy, createNonce } from '@/lib/csp';

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    upgradeInsecure: isHttpsOrigin(process.env.APP_ORIGIN),
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
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
