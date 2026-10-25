import 'server-only';
import type { GatedAction } from '@hucxter/contracts';
import { redirect } from 'next/navigation';
import { track } from './analytics';
import { authHref } from './next-path';
import { getViewer } from './viewer';
import type { Viewer } from './viewer';

/**
 * Server-side gate for member-only routes: guests are redirected to /sign-in?next=<path>.
 * Runs on every request in the page itself (not only in middleware).
 */
export async function requireMember(
  path: string,
  action: GatedAction,
): Promise<Extract<Viewer, { kind: 'member' }>> {
  const viewer = await getViewer();
  if (viewer.kind === 'member') return viewer;
  track({ name: 'sign_in_prompted', action, surface: 'header' });
  redirect(authHref(path));
}
