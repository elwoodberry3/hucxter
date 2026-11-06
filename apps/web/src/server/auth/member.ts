import 'server-only';
import type { OnboardingStep } from '@hucxter/contracts';
import { cache } from 'react';
import { z } from 'zod';
import { authConfig } from '@/lib/env';
import { sessionClient } from '../supabase-server';
import { verificationState } from './verification';
import type { MemberState } from './verification';

const ProfileRow = z.object({
  display_name: z.string().nullable(),
  home_zip: z.string().nullable(),
  age_attested_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});
const RoleRows = z.array(z.object({ role: z.string() }));

/**
 * The signed-in member and their verification state, or null for guests. Validates the session
 * with the Auth server (`getUser()`), so a session revoked by "Sign out everywhere" or a deleted
 * account counts as signed out even while its access token hasn't expired. Cached per request.
 */
export const loadMember = cache(async (): Promise<MemberState | null> => {
  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error !== null) return null;
  const { user } = data;

  const { inviteOnly } = authConfig();
  const [profile, roles, invited] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, home_zip, age_attested_at, deleted_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('app_roles').select('role').eq('user_id', user.id),
    inviteOnly
      ? supabase.rpc('current_user_invited')
      : Promise.resolve({ data: true, error: null }),
  ]);
  if (profile.error !== null || roles.error !== null || invited.error !== null) {
    throw new Error('Could not load the member profile');
  }
  if (profile.data === null) return null;
  const row = ProfileRow.parse(profile.data);
  if (row.deleted_at !== null) return null;

  return verificationState({
    userId: user.id,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    phoneConfirmedAt: user.phone_confirmed_at ?? null,
    phone: user.phone ?? null,
    profile: {
      displayName: row.display_name,
      homeZip: row.home_zip,
      ageAttestedAt: row.age_attested_at,
    },
    roles: RoleRows.parse(roles.data).map(({ role }) => role),
    invited: invited.data === true,
    inviteOnly,
  });
});

export type { MemberState, OnboardingStep };
