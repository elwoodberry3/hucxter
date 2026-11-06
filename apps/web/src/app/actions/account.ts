'use server';

import { DeleteAccountInput, ProfileUpdate } from '@hucxter/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { lookupPostalArea } from '@/lib/postal-areas';
import { deleteAccount as deleteAccountNow } from '@/server/account/delete-account';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { requireSignedIn, requireVerifiedMember } from '@/server/auth/gate';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { sessionClient } from '@/server/supabase-server';

export type AccountResult = { status: 'saved' } | { status: 'error'; message: string };

/** Signs out this browser only (revokes this session server-side and clears its cookies). */
export async function signOut(): Promise<void> {
  if (!(await requestIsSameOrigin())) redirect('/');
  const supabase = await sessionClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}

/** "Sign out everywhere": revokes every session of this account, on every device. */
export async function signOutEverywhere(): Promise<void> {
  if (!(await requestIsSameOrigin())) redirect('/settings');
  await requireSignedIn('/settings');
  const supabase = await sessionClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/');
}

/** Settings → Profile: display name and home ZIP (any valid US ZIP). */
export async function updateProfile(input: unknown): Promise<AccountResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const member = await requireVerifiedMember('/settings', 'settings');
  const parsed = ProfileUpdate.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const area = await lookupPostalArea(parsed.data.zip);
  if (area === null) {
    return {
      status: 'error',
      message: 'We couldn’t find that ZIP. Try the ZIP where you live or pick up items.',
    };
  }
  const supabase = await sessionClient();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName, home_zip: area.zip })
    .eq('id', member.userId);
  return error === null ? { status: 'saved' } : { status: 'error', message: GENERIC_ERROR };
}

/**
 * Deletes the account after a typed confirmation ("DELETE"): audit entry, all sessions revoked,
 * user deleted, cookies cleared. Available to any signed-in member, verified or not.
 */
export async function deleteAccount(input: unknown): Promise<AccountResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const member = await requireSignedIn('/settings');
  if (!DeleteAccountInput.safeParse(input).success) {
    return { status: 'error', message: 'Type DELETE to confirm.' };
  }
  const supabase = await sessionClient();
  const { ok } = await deleteAccountNow(member.userId, supabase);
  if (!ok) return { status: 'error', message: GENERIC_ERROR };
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (/^sb-.+-auth-token/.test(name)) store.delete(name);
  }
  redirect('/?deleted=1');
}
