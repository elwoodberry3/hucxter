import 'server-only';

/** Discover's JSON reads are per viewer and never cached by a shared cache. */
export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/**
 * Discover's JSON reads are for the app's own pages: a browser request from another site (or a
 * frame elsewhere) is refused. Requests without Sec-Fetch-Site (non-browser clients) are allowed;
 * they only see what /l/[id] already shows.
 */
export function refuseCrossSite(request: Request): Response | null {
  const site = request.headers.get('sec-fetch-site');
  if (site === null || site === 'same-origin') return null;
  return new Response('Forbidden', { status: 403, headers: NO_STORE });
}
