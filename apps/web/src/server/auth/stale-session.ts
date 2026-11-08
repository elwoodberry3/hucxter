/**
 * Stale sessions (Brief 03C.1b H5): a session cookie whose token or user no longer exists (e.g.
 * after `supabase db reset`, a deleted account, or a rotated signing key) must never break a page.
 * Reads fall back to a guest, and the session cookies are cleared. A network failure or an Auth
 * outage is not "stale": the cookies stay, so a blip never signs anyone out.
 */
export const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

const STALE_CODES = new Set([
  'bad_jwt',
  'session_not_found',
  'session_expired',
  'user_not_found',
  'refresh_token_not_found',
  'refresh_token_already_used',
]);

interface AuthErrorLike {
  name?: string;
  status?: number;
  code?: string;
}

/** True for an Auth error that means the session itself is invalid. */
export function isStaleAuthError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, status, code } = error as AuthErrorLike;
  if (name === 'AuthRetryableFetchError') return false;
  if (name === 'AuthInvalidJwtError') return true;
  if (code !== undefined && STALE_CODES.has(code)) return true;
  return status === 401 || status === 403;
}

interface PostgrestResultLike {
  status?: number;
  error: { code?: string } | null;
}

/** True when PostgREST refused the request's JWT (expired, bad signature, unknown key). */
export function isStaleSessionRead(result: PostgrestResultLike): boolean {
  if (result.error === null) return false;
  const code = result.error.code ?? '';
  return result.status === 401 || code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303';
}
