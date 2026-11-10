import 'server-only';
import { cookies } from 'next/headers';
import { serverConfig } from '@/lib/env';
import { loadMemberForDisplay } from '@/server/auth/member';
import { VIEW_COOKIE, newViewId, nextUtcMidnight, validViewId } from './view-cookie';

/**
 * Who a view beacon counts as: `member:<id>` (hashed with a daily salt before storage), or for
 * guests `guest:<hx_vid>`, setting a fresh hx_vid that expires at the next UTC midnight. Route
 * handlers only (it may set a cookie).
 */
export async function viewActor(): Promise<{ actor: string; viewerId: string | null }> {
  const member = await loadMemberForDisplay();
  if (member !== null) return { actor: `member:${member.userId}`, viewerId: member.userId };
  const store = await cookies();
  const existing = store.get(VIEW_COOKIE)?.value;
  const id = validViewId(existing) ? existing : newViewId();
  if (id !== existing) {
    store.set(VIEW_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: serverConfig().appOrigin.protocol === 'https:',
      path: '/',
      expires: nextUtcMidnight(),
    });
  }
  return { actor: `guest:${id}`, viewerId: null };
}
