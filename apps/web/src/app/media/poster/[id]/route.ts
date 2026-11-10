import { z } from 'zod';
import { getViewerLocation } from '@/lib/viewer-location';
import { posterUrl } from '@/server/media/playback';
import { loadListingView } from '@/server/listings/public';
import { sessionClient } from '@/server/supabase-server';
import { codeOf, logError } from '@/server/log';

export const dynamic = 'force-dynamic';

/**
 * Card posters (Brief 03C.1 §3.5): a same-origin URL that redirects to a short-lived signed
 * thumbnail, only for listings the viewer may see. Cards never carry a token, so cached HTML and
 * crawlers can't hold one.
 */
export async function GET(_request: Request, { params }: RouteContext<'/media/poster/[id]'>) {
  const { id } = await params;
  const listingId = z.uuid().safeParse(id);
  if (!listingId.success) return new Response('Not found', { status: 404 });
  const view = await loadListingView(
    await sessionClient(),
    listingId.data,
    (await getViewerLocation())?.zip ?? null,
  );
  if (view?.kind !== 'listing' || view.mediaId === null) {
    return new Response('Not found', { status: 404 });
  }
  let url: string | null;
  try {
    url = await posterUrl(view.mediaId, 480);
  } catch (error) {
    // The video provider being down (or unconfigured) costs the card its poster, nothing more.
    logError('poster_unavailable', { code: codeOf(error) });
    url = null;
  }
  if (url === null) return new Response('Not found', { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'private, max-age=300' },
  });
}
