'use server';

import { SaveInput } from '@hucxter/contracts';
import { revalidatePath } from 'next/cache';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { loadMember } from '@/server/auth/member';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { recordEvent } from '@/server/events';
import { sessionClient } from '@/server/supabase-server';

export type SaveResult =
  { status: 'ok'; saved: boolean } | { status: 'error'; saved: boolean; message: string };

/**
 * Save or unsave a listing (Brief 03C.2 §4.3). Verified members only; listing_save checks the
 * listing is live and not the caller's own, and applies the daily limit. The result carries the
 * server's state so the optimistic button can reconcile or roll back.
 */
export async function toggleSave(input: unknown): Promise<SaveResult> {
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { status: 'error', saved: false, message: GENERIC_ERROR };
  const { listingId, saved } = parsed.data;
  const failed = (message: string): SaveResult => ({ status: 'error', saved: !saved, message });
  if (!(await requestIsSameOrigin())) return failed(ORIGIN_ERROR);
  let userId: string;
  try {
    const member = await loadMember();
    if (member === null || !member.verified) {
      return failed('Finish setting up your account to save listings.');
    }
    userId = member.userId;
  } catch {
    return failed(GENERIC_ERROR);
  }
  const result = await (
    await sessionClient()
  ).rpc('listing_save', { p_id: listingId, p_saved: saved });
  const data: unknown = result.data;
  if (result.error !== null || typeof data !== 'string') return failed(GENERIC_ERROR);
  if (data.startsWith('retry_after:')) {
    return failed('You’ve saved a lot today. Try again tomorrow.');
  }
  if (data === 'not_found') return failed('This listing can’t be saved any more.');
  await recordEvent(
    { name: saved ? 'listing_saved' : 'listing_unsaved' },
    { listingId, actor: userId },
  );
  revalidatePath('/u/[handle]', 'page');
  return { status: 'ok', saved: data === 'saved' };
}
