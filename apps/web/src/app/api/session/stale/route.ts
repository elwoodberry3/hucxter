import { cookies } from 'next/headers';
import { serverConfig } from '@/lib/env';
import { authCookieOptions, hardenCookie } from '@/server/auth/cookies';
import { rejectCrossOrigin } from '@/server/auth/origin';
import { AUTH_COOKIE, isStaleAuthError } from '@/server/auth/stale-session';
import { logError } from '@/server/log';
import { sessionClient } from '@/server/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Clears session cookies that Auth no longer accepts (Brief 03C.1b H5), for StaleSessionCleanup:
 * Server Components can't write cookies. It checks the session with the Auth server first and
 * clears only when Auth refuses it as invalid, so it never signs out a working session (and an
 * Auth outage changes nothing).
 */
export async function POST(request: Request): Promise<Response> {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin !== null) return crossOrigin;
  const headers = { 'Cache-Control': 'no-store' };
  const { error } = await (await sessionClient()).auth.getUser();
  if (error === null || error.name === 'AuthSessionMissingError' || !isStaleAuthError(error)) {
    return new Response(null, { status: 204, headers });
  }
  const store = await cookies();
  const base = authCookieOptions(serverConfig());
  for (const { name } of store.getAll()) {
    if (AUTH_COOKIE.test(name)) store.set(name, '', hardenCookie({ maxAge: 0 }, base));
  }
  logError('stale_session_cleared', { status: error.status, code: error.code });
  return new Response(null, { status: 204, headers });
}
