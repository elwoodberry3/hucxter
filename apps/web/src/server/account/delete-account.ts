import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminDb } from '../admin-db';

/**
 * Deletes a member's account (brief 3B FR5; Founder amendment 2 in 3C.1), in this order:
 * 1. account_delete_prepare, one transaction: the audit_log row (ids only), jobs that revoke
 *    playback and delete every video at Mux (payloads hold the Mux ids, so they outlive the
 *    rows), and the member's listings hidden at once.
 * 2. Every session revoked, so no device can mint a new access token.
 * 3. The auth user deleted: profile, roles, listings and media cascade from auth.users. OTP
 *    counters are kept with user_id set null (abuse limits outlive the account). Events and
 *    reports have no foreign key to listings, so they stay queryable.
 * If step 3 fails, an `account.delete_failed` row is written; the member can try again (step 1
 * is safe to repeat: the Mux jobs treat "already gone" as done).
 */
export async function deleteAccount(
  userId: string,
  session: SupabaseClient,
): Promise<{ ok: boolean }> {
  const admin = adminDb();
  const prepared = await admin.rpc('account_delete_prepare', { p_user_id: userId });
  if (prepared.error !== null) return { ok: false };

  await session.auth.signOut({ scope: 'global' });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error !== null) {
    await admin.from('audit_log').insert({
      actor_id: userId,
      action: 'account.delete_failed',
      target_type: 'user',
      target_id: userId,
      reason: 'self-service',
    });
    return { ok: false };
  }
  return { ok: true };
}
