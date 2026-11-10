import { getViewerLocation } from '@/lib/viewer-location';
import { discoverItem } from '@/server/discover';
import { NO_STORE, refuseCrossSite } from '@/server/discover-http';
import { codeOf, logError } from '@/server/log';

export const dynamic = 'force-dynamic';

/**
 * One Discover item: details for the sheet plus signed playback. The feed asks only for its
 * active and next items. 404 when the item left the feed (sold, deleted, removed, in review): the
 * client shows "no longer available" and never retries. 503 on a database error (retryable).
 */
export async function GET(
  request: Request,
  { params }: RouteContext<'/api/discover/items/[id]'>,
): Promise<Response> {
  const refused = refuseCrossSite(request);
  if (refused !== null) return refused;
  try {
    const location = await getViewerLocation();
    const item = await discoverItem((await params).id, location?.zip ?? null);
    if (item === null) return new Response(null, { status: 404, headers: NO_STORE });
    return Response.json(item, { headers: NO_STORE });
  } catch (error) {
    logError('discover_item_failed', { code: codeOf(error) });
    return new Response(null, { status: 503, headers: NO_STORE });
  }
}
