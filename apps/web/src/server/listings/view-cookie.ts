import 'server-only';
import { randomBytes } from 'node:crypto';

/**
 * hx_vid (Founder amendment 4): a random guest id used only to count one listing_viewed per guest
 * per listing per UTC day. A fresh value each day; it expires at the next UTC midnight, and it is
 * hashed with a daily salt before storage, so views can't be linked across days.
 */
export const VIEW_COOKIE = 'hx_vid';

export function nextUtcMidnight(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function newViewId(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Brief 03C.1b H3: only a same-origin page load counts (the listing page's own beacon). Requests
 * without Sec-Fetch-Site (scripts, older clients) or from other sites are answered but not
 * counted. Scripts can forge the header, so the database's daily caps are the real bound.
 */
export function countableView(headers: Headers): boolean {
  return headers.get('sec-fetch-site') === 'same-origin';
}

export function validViewId(value: string | undefined): value is string {
  return value !== undefined && /^[A-Za-z0-9_-]{22}$/.test(value);
}
