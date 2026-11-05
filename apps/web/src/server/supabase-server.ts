import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { serverConfig, supabaseConfig } from '@/lib/env';
import { authCookieOptions, hardenCookie } from './auth/cookies';

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
