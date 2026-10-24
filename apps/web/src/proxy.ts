import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { contentSecurityPolicy, createNonce } from '@/lib/csp';

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    upgradeInsecure: process.env.APP_ORIGIN?.startsWith('https://') ?? false,
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // HTML documents only: skip API routes, build assets, and files with an extension.
      source: '/((?!api/|_next/static|_next/image|.*\\.[a-z0-9]+$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
