import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabaseConfig } from '@/lib/env';

/**
 * The ONLY module that reads the service-role (secret) key (brief §5). It bypasses RLS, so it is
 * used only for account deletion, audit-log writes, and abuse counters (and, from 3C, webhooks,
 * jobs, and admin actions). `admin-db.guard.test.ts` fails if any other module reads the key or
 * imports this file from outside the allowed callers.
 */
const SecretKey = z.string().min(20);

function secretKey(): string {
  const parsed = SecretKey.safeParse(process.env.SUPABASE_SECRET_KEY);
  if (!parsed.success) {
    throw new Error('SUPABASE_SECRET_KEY must be set for account deletion and abuse limits');
  }
  return parsed.data;
}

let client: SupabaseClient | undefined;

export function adminDb(): SupabaseClient {
  if (client === undefined) {
    client = createClient(supabaseConfig().url, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

/**
 * Keyed hash for rate-limit counters, so an email or phone number is never stored. The key is
 * derived from the secret key; rotating that key resets the counters, which is acceptable.
 */
export function subjectHash(kind: 'email' | 'phone', normalized: string): string {
  const key = createHmac('sha256', secretKey()).update('hucxter-otp-limits-v1').digest();
  return createHmac('sha256', key).update(`${kind}:${normalized}`).digest('hex');
}
