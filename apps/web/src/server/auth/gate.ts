import 'server-only';
import type { GatedAction } from '@hucxter/contracts';
import { notFound, redirect } from 'next/navigation';
import { track } from '@/lib/analytics';
import { authHref, welcomeHref } from '@/lib/next-path';
import { loadMember } from './member';
import type { MemberState } from './member';

export type VerifiedMember = MemberState & { verified: true };

/**
 * Signed in, verified or not: onboarding, sign out, and account deletion. Guests are redirected
 * to /sign-in?next=<next>.
 */
export async function requireSignedIn(next: string): Promise<MemberState> {
  const member = await loadMember();
  if (member === null) redirect(authHref(next));
  return member;
}

/**
 * THE gate for every member-only page and action (D-34). Guests go to sign-in; signed-in members
 * who aren't verified (email, phone, 18+, home ZIP, and invited when INVITE_ONLY) go to
 * /welcome?next=<next>. Runs in the page or action itself on every request, not only in the proxy.
 */
export async function requireVerifiedMember(
  next: string,
  action: GatedAction,
): Promise<VerifiedMember> {
  const member = await loadMember();
  if (member === null) {
    track({ name: 'sign_in_prompted', action, surface: 'header' });
    redirect(authHref(next));
  }
  if (!member.verified) redirect(welcomeHref(next));
  return member as VerifiedMember;
}

/** Staff-only pages (/admin): 404 for everyone else, checked on every request. */
export async function requireStaff(): Promise<VerifiedMember> {
  const member = await loadMember();
  if (member === null || !member.verified || !member.isStaff) notFound();
  return member as VerifiedMember;
}
