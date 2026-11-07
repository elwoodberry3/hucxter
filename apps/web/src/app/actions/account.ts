'use server';

import {
  DeleteAccountInput,
  HANDLE_STATUSES,
  HANDLE_STATUS_MESSAGES,
  ProfileUpdate,
} from '@hucxter/contracts';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { lookupPostalArea } from '@/lib/postal-areas';
import { deleteAccount as deleteAccountNow } from '@/server/account/delete-account';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { requireSignedIn, requireVerifiedMember } from '@/server/auth/gate';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { sessionClient } from '@/server/supabase-server';
import { z } from 'zod';

export type AccountResult = { status: 'saved' } | { status: 'error'; message: string };

const HandleStatusSchema = z.enum(HANDLE_STATUSES);

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

export type ProfileField = 'displayName' | 'handle' | 'bio' | 'zip';
export type ProfileResult =
  { status: 'saved'; handle: string } | { status: 'error'; message: string; field?: ProfileField };

const HANDLE_NOT_SAVED = 'Your other changes were saved, but not the new handle.';

const FIELDS: readonly ProfileField[] = ['displayName', 'handle', 'bio', 'zip'];

/**
 * Settings → Edit profile (Brief 03C.2 §4.4): display name, @handle (at most one change per 30
 * days, checked in the database), bio and home ZIP. The other fields are saved first; a refused
 * handle is reported on its own.
 */
export async function updateProfile(input: unknown): Promise<ProfileResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const member = await requireVerifiedMember('/settings/profile', 'settings');
  const parsed = ProfileUpdate.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = FIELDS.find((f) => f === issue?.path[0]);
    return {
      status: 'error',
      message: issue?.message ?? GENERIC_ERROR,
      ...(field === undefined ? {} : { field }),
    };
  }
  const { displayName, handle, bio, zip } = parsed.data;
  const area = await lookupPostalArea(zip);
  if (area === null) {
    return {
      status: 'error',
      field: 'zip',
      message: 'We couldn’t find that ZIP. Try the ZIP where you live or pick up items.',
    };
  }
  // Fields first: if they fail, the handle (and its 30-day clock) is left alone.
  const supabase = await sessionClient();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, bio, home_zip: area.zip })
    .eq('id', member.userId);
  if (error !== null) return { status: 'error', message: GENERIC_ERROR };
  revalidatePath('/u/[handle]', 'page');
  revalidatePath('/settings', 'layout');
  if (handle !== member.handle) {
    const result = await supabase.rpc('profile_set_handle', { p_handle: handle });
    const data: unknown = result.data;
    if (result.error !== null || typeof data !== 'string') {
      return { status: 'error', field: 'handle', message: HANDLE_NOT_SAVED };
    }
    const refused = handleRefusal(data);
    if (refused !== null) {
      return { status: 'error', field: 'handle', message: `${HANDLE_NOT_SAVED} ${refused}` };
    }
  }
  return { status: 'saved', handle };
}

/** Copy for profile_set_handle's answer, or null when the handle was set ('ok'). */
function handleRefusal(answer: string): string | null {
  if (answer === 'ok' || answer === 'yours') return null;
  if (answer.startsWith('too_soon:')) {
    const when = new Date(answer.slice('too_soon:'.length));
    const day = Number.isNaN(when.getTime())
      ? 'later'
      : `on ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    return `You can change your handle once every 30 days. Try again ${day}.`;
  }
  const status = HandleStatusSchema.safeParse(answer);
  return status.success ? HANDLE_STATUS_MESSAGES[status.data] : GENERIC_ERROR;
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
