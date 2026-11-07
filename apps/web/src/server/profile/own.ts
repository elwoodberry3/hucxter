import 'server-only';
import { redirect } from 'next/navigation';
import type { GatedAction } from '@hucxter/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireVerifiedMember } from '@/server/auth/gate';
import { welcomeHref } from '@/lib/next-path';

/**
 * The signed-in member's own profile path (/profile, /listings and /saved redirect there).
 * Guests go to sign-in, unverified members to /welcome; a member without a handle yet (name step
 * not done) goes to /welcome and comes back.
 */
export async function requireOwnProfilePath(next: string, action: GatedAction): Promise<string> {
  const member = await requireVerifiedMember(next, action);
  if (member.handle === null) redirect(welcomeHref(next));
  return `/u/${member.handle}`;
}

const OwnSettingsRow = z.object({
  bio: z.string(),
  handle_changed_at: z.string().nullable(),
});

export interface OwnProfileSettings {
  bio: string;
  /** When the handle can next change (30-day rule), or null when it can change now. */
  handleChangeableAt: string | null;
}

/** The signed-in member's own bio and handle-change date (RLS: own row only). */
export async function loadOwnProfileSettings(db: SupabaseClient): Promise<OwnProfileSettings> {
  const { data, error } = await db.from('profiles').select('bio, handle_changed_at').single();
  if (error !== null) throw new Error(`own_profile:${error.code}`);
  const row = OwnSettingsRow.parse(data);
  const next =
    row.handle_changed_at === null
      ? null
      : new Date(new Date(row.handle_changed_at).getTime() + 30 * 86_400_000);
  return {
    bio: row.bio,
    handleChangeableAt: next !== null && next.getTime() > Date.now() ? next.toISOString() : null,
  };
}
