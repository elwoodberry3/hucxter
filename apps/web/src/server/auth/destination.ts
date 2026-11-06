import { safeNextPath, welcomeHref } from '@/lib/next-path';
import type { CallbackOutcome } from './errors';

/** Where a member goes right after signing in: `next` once verified, otherwise /welcome. */
export function destinationAfterSignIn(
  member: { verified: boolean } | null,
  next: unknown,
): string {
  const safe = safeNextPath(next);
  if (member === null || !member.verified) return welcomeHref(safe);
  return safe ?? '/';
}

/** The sign-in page showing a fixed message for a failed Google sign-in, keeping a safe `next`. */
export function signInErrorHref(outcome: CallbackOutcome, next: unknown): string {
  const params = new URLSearchParams({ error: outcome });
  const safe = safeNextPath(next);
  if (safe !== null && safe !== '/') params.set('next', safe);
  return `/sign-in?${params.toString()}`;
}
