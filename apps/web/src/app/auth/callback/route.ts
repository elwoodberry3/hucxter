import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/env';
import { callbackRedirect } from '@/server/auth/callback';
import { isClosedTestRejection } from '@/server/auth/errors';
import { loadMember } from '@/server/auth/member';
import { sessionClient } from '@/server/supabase-server';

/** Google OAuth callback (PKCE): exchanges the code for a session cookie, then routes onward. */
export async function GET(request: NextRequest) {
  const supabase = await sessionClient();
  const path = await callbackRedirect(request.nextUrl, {
    exchange: async (code) => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return { ok: error === null, closedTest: isClosedTestRejection(error) };
    },
    member: loadMember,
  });
  // Always our own origin: `path` is a same-origin path from callbackRedirect.
  return NextResponse.redirect(new URL(path, serverConfig().appOrigin), { status: 303 });
}
