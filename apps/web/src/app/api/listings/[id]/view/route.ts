import { z } from 'zod';
import { rejectCrossOrigin } from '@/server/auth/origin';
import { recordEvent } from '@/server/events';
import { loadListingView } from '@/server/listings/public';
import { viewActor } from '@/server/listings/view-actor';
import { countableView } from '@/server/listings/view-cookie';
import { sessionClient } from '@/server/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * listing_viewed beacon, sent by the listing page after it renders in a browser (so prefetches
 * and non-JS crawlers don't count). Members are counted by a daily-salted hash of their id,
 * guests by hx_vid. The owner's own views are dropped by the database. No IP is stored. Only
 * same-origin page loads count, and the database caps guest views and events per listing per day.
 */
export async function POST(request: Request, { params }: RouteContext<'/api/listings/[id]/view'>) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin !== null) return crossOrigin;
  if (!countableView(request.headers)) {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response(null, { status: 404 });
  const view = await loadListingView(await sessionClient(), id.data, null);
  if (view?.kind !== 'listing' || view.inReview) return new Response(null, { status: 404 });
  if (view.isOwner) return new Response(null, { status: 204 });

  const { actor, viewerId } = await viewActor();
  await recordEvent({ name: 'listing_viewed' }, { listingId: view.listing.id, actor, viewerId });
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
