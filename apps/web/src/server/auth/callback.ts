import { safeNextPath } from '@/lib/next-path';
import { destinationAfterSignIn, signInErrorHref } from './destination';
import { callbackErrorOutcome } from './errors';

export interface CallbackDeps {
  /** Exchanges the PKCE code (verifier read from the httpOnly cookie) for a session. */
  exchange: (code: string) => Promise<{ ok: boolean; closedTest: boolean }>;
  /** The member's verification state after the exchange. */
  member: () => Promise<{ verified: boolean } | null>;
}

const CODE = /^[A-Za-z0-9._~-]{1,512}$/;

/**
 * Google OAuth callback (PKCE). Supabase redirects here with `code` (or `error*`) after Google
 * consent; Supabase itself checks the OAuth `state` with Google. Returns a same-origin path:
 * the sign-in page with a fixed error, /welcome, or the safe `next`.
 */
export async function callbackRedirect(url: URL, deps: CallbackDeps): Promise<string> {
  const next = safeNextPath(url.searchParams.get('next'));
  if (url.searchParams.has('error') || url.searchParams.has('error_description')) {
    return signInErrorHref(callbackErrorOutcome(url.searchParams), next);
  }
  const code = url.searchParams.get('code');
  if (code === null || !CODE.test(code)) return signInErrorHref('failed', next);

  const result = await deps.exchange(code);
  if (!result.ok) return signInErrorHref(result.closedTest ? 'closed_test' : 'failed', next);
  return destinationAfterSignIn(await deps.member(), next);
}
