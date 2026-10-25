import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './env';

let client: SupabaseClient | undefined;

/**
 * Server-side client for public, RLS-limited reads with the publishable key. No session, no
 * cookies: it acts as the `anon` role. Mutations never go through this client.
 */
export function publicDb(): SupabaseClient {
  if (client === undefined) {
    const { url, publishableKey } = supabaseConfig();
    client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
