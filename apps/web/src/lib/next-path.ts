/**
 * Return-path handling for sign-in gating (hucxter-trust-safety: no open redirects).
 * Shared by server and client code.
 */

const BASE = 'https://hucxter.invalid';
const MAX_LENGTH = 512;
// eslint-disable-next-line no-control-regex -- control characters are exactly what we reject
const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/;
const AUTH_PATHS = new Set(['/sign-in', '/sign-up']);

function looksUnsafe(path: string): boolean {
  return !path.startsWith('/') || path.startsWith('//') || UNSAFE_CHARS.test(path);
}

/**
 * Returns `raw` normalized as a same-origin relative path (path + query + hash), or null if it
 * isn't one. Rejects absolute URLs, protocol-relative `//host`, backslashes, control characters,
 * and encoded variants of those, and never returns a path to the sign-in pages themselves.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (looksUnsafe(raw)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (looksUnsafe(decoded)) return null;

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;

  const path = `${url.pathname}${url.search}${url.hash}`;
  // Dot segments can normalize into `//host` (e.g. "/.//evil.example").
  if (looksUnsafe(path) || AUTH_PATHS.has(url.pathname)) return null;
  return path;
}

/** `/sign-in?next=…` (or `/sign-up`), keeping `next` only when it's safe. */
export function authHref(
  next: string | null | undefined,
  page: '/sign-in' | '/sign-up' = '/sign-in',
): string {
  const safe = safeNextPath(next);
  return safe === null || safe === '/' ? page : `${page}?next=${encodeURIComponent(safe)}`;
}
