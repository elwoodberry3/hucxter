'use server';

import { ListingIdInput, StatusChangeInput } from '@hucxter/contracts';
import { revalidatePath } from 'next/cache';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { loadMember } from '@/server/auth/member';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { recordEvent } from '@/server/events';
import { loadOwnListing } from '@/server/listings/owner';
import { sessionClient } from '@/server/supabase-server';

/**
 * Owner listing management (Brief 03C.1 §3.6): Pending ("someone's on the way") → They didn't
 * show (Available) → Sold, and delete. The database checks ownership and legal transitions and
 * records every change in listing_status_history.
 */
export type OwnerResult = { status: 'ok' } | { status: 'error'; message: string };

async function verifiedUserId(): Promise<string | OwnerResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  try {
    const member = await loadMember();
    if (member === null || !member.verified) {
      return { status: 'error', message: 'Sign in again to manage your listings.' };
    }
    return member.userId;
  } catch {
    return { status: 'error', message: GENERIC_ERROR };
  }
}

export async function setListingStatus(input: unknown): Promise<OwnerResult> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return userId;
  const parsed = StatusChangeInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: GENERIC_ERROR };
  const supabase = await sessionClient();
  const own = await loadOwnListing(supabase, parsed.data.listingId);
  if (own === null || own.status === 'draft') {
    return { status: 'error', message: 'We couldn’t find that listing.' };
  }
  const { error } = await supabase.rpc('listing_set_status', {
    p_id: own.id,
    p_status: parsed.data.status,
  });
  if (error !== null) {
    return {
      status: 'error',
      message:
        error.code === '23514'
          ? 'That change isn’t possible any more. Reload the page.'
          : GENERIC_ERROR,
    };
  }
  await recordEvent(
    { name: 'listing_status_changed', from: own.status, to: parsed.data.status },
    { listingId: own.id, actor: userId },
  );
  revalidatePath(`/l/${own.id}`);
  revalidatePath('/listings');
  return { status: 'ok' };
}

export async function deleteListing(input: unknown): Promise<OwnerResult> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return userId;
  const parsed = ListingIdInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: GENERIC_ERROR };
  const { error } = await (
    await sessionClient()
  ).rpc('listing_delete', {
    p_id: parsed.data.listingId,
  });
  if (error !== null) return { status: 'error', message: 'We couldn’t delete that listing.' };
  revalidatePath('/listings');
  revalidatePath('/');
  return { status: 'ok' };
}
