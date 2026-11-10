import { getViewerLocation } from '@/lib/viewer-location';
import { discoverPage } from '@/server/discover';
import { NO_STORE, refuseCrossSite } from '@/server/discover-http';

export const dynamic = 'force-dynamic';

/**
 * The next page of the Discover feed (`?after=<cursor>`), for the viewer's own location cookie and
 * radius. Never takes a location from the request.
 */
export async function GET(request: Request): Promise<Response> {
  const refused = refuseCrossSite(request);
  if (refused !== null) return refused;
  const after = new URL(request.url).searchParams.get('after');
  if (after === null || after.length > 200) {
    return Response.json({ items: [], nextCursor: null }, { headers: NO_STORE });
  }
  const location = await getViewerLocation();
  const page = await discoverPage(
    { zip: location?.zip ?? null, radiusMi: location?.radiusMi },
    { after },
  );
  return Response.json({ items: page.items, nextCursor: page.nextCursor }, { headers: NO_STORE });
}
