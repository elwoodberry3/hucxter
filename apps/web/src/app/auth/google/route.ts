import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/env';
import { safeNextPath } from '@/lib/next-path';
import { signInErrorHref } from '@/server/auth/destination';
import { sessionClient } from '@/server/supabase-server';

/**
 * Starts Google sign-in (D-34): Supabase's built-in provider with PKCE and `openid email profile`.
 * A GET link rather than a form POST, because the CSP's `form-action 'self'` would block a POST
 * that redirects to Google. It changes no account state (it only stores the PKCE verifier in an
 * httpOnly cookie), and cross-site requests are refused via Sec-Fetch-Site.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const config = serverConfig();
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return new Response('Forbidden', { status: 403 });
  }

  const callback = new URL('/auth/callback', config.appOrigin);
  if (next !== null && next !== '/') callback.searchParams.set('next', next);

  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
      scopes: 'openid email profile',
      skipBrowserRedirect: true,
    },
  });
  const target =
    error === null
      ? data.url
      : new URL(signInErrorHref('failed', next), config.appOrigin).toString();
  return NextResponse.redirect(target, { status: 303 });
}
