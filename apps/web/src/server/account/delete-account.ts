import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminDb } from '../admin-db';

/**
 * Deletes a member's account (brief 3B FR5): records it in audit_log (ids only), revokes every
 * session, then deletes the auth user. The profile, roles, and OTP counters cascade from
 * auth.users. Listings and media join this in 3C.
 */
export async function deleteAccount(
  userId: string,
  session: SupabaseClient,
): Promise<{ ok: boolean }> {
  const admin = adminDb();
  const audit = await admin.from('audit_log').insert({
    actor_id: userId,
    action: 'account.deleted',
    target_type: 'user',
    target_id: userId,
    reason: 'self-service',
  });
  if (audit.error !== null) return { ok: false };

  // Revoke all refresh tokens first, so no device can mint a new access token.
  await session.auth.signOut({ scope: 'global' });
  const { error } = await admin.auth.admin.deleteUser(userId);
  return { ok: error === null };
}
