import 'server-only';
import { redirect } from 'next/navigation';
import type { GatedAction } from '@hucxter/contracts';
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
