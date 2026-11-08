import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { serverConfig, supabaseConfig } from '@/lib/env';
import { authCookieOptions, hardenCookie } from './auth/cookies';
import { isStaleSessionRead } from './auth/stale-session';
import { logError } from './log';

/**
 * The signed-in member's Supabase client (publishable key + their session cookies), so every query
 * runs under RLS as that member. Server code only; there is no browser client. In Server Components
 * cookies can't be written; the proxy refreshes the session before rendering, so the write is
 * skipped there. One client per request.
 */
export const sessionClient = cache(async (): Promise<SupabaseClient> => {
  const { url, publishableKey } = supabaseConfig();
  const config = serverConfig();
  const base = authCookieOptions(config);
  const store = await cookies();
  return createServerClient(url, publishableKey, {
    cookieOptions: base,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, hardenCookie(options, base));
          }
        } catch {
          // Called from a Server Component: the proxy already refreshed the session.
        }
      },
    },
  });
});

let guest: SupabaseClient | undefined;

/** A client with no session (publishable key only): what a guest sees. Holds no state. */
export function guestClient(): SupabaseClient {
  if (guest === undefined) {
    guest = createClient(supabaseConfig().url, supabaseConfig().publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return guest;
}

const staleState = cache(() => ({ stale: false }));

/**
 * Brief 03C.1b H5: this request's session turned out to be invalid (Auth or PostgREST refused
 * it). The store layout then renders StaleSessionCleanup, which asks /api/session/stale to clear
 * the cookies (Server Components can't).
 */
export function markStaleSession(): void {
  staleState().stale = true;
}

export function sessionIsStale(): boolean {
  return staleState().stale;
}

/**
 * Runs a read with `db` (normally the session client); if PostgREST refuses the session's token,
 * logs it (status and code only), marks the session stale and runs the read again as a guest, so
 * the page still renders (Brief 03C.1b H5).
 */
export async function readOrGuest<T extends { status: number; error: { code?: string } | null }>(
  db: SupabaseClient,
  event: string,
  run: (client: SupabaseClient) => PromiseLike<T>,
): Promise<T> {
  const result = await run(db);
  if (!isStaleSessionRead(result)) return result;
  logError(`${event}_stale_session`, { status: result.status, code: result.error?.code });
  markStaleSession();
  return run(guestClient());
}
