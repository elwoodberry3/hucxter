import 'server-only';
import { headers } from 'next/headers';
import { serverConfig } from '@/lib/env';

/**
 * CSRF check (hucxter-trust-safety): a state-changing request must carry an Origin header equal to
 * APP_ORIGIN. A missing Origin is refused; browsers send it on every POST.
 */
export function isSameOrigin(origin: string | null | undefined, appOrigin: URL): boolean {
  if (origin === null || origin === undefined || origin === '' || origin === 'null') return false;
  try {
    return new URL(origin).origin === appOrigin.origin;
  } catch {
    return false;
  }
}

/** For server actions: reads the request headers. Next's own action check also runs. */
export async function requestIsSameOrigin(): Promise<boolean> {
  return isSameOrigin((await headers()).get('origin'), serverConfig().appOrigin);
}

/** For route handlers: a 403 response when the Origin doesn't match, else null. */
export function rejectCrossOrigin(request: Request): Response | null {
  if (isSameOrigin(request.headers.get('origin'), serverConfig().appOrigin)) return null;
  return new Response('Forbidden', { status: 403 });
}
