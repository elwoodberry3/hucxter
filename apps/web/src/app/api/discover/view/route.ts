import { z } from 'zod';
import { rejectCrossOrigin } from '@/server/auth/origin';
import { recordEvent } from '@/server/events';
import { readCapped } from '@/server/http/read-capped';
import { loadListingView } from '@/server/listings/public';
import { viewActor } from '@/server/listings/view-actor';
import { countableView } from '@/server/listings/view-cookie';
import { sessionClient } from '@/server/supabase-server';

export const dynamic = 'force-dynamic';

const ViewInput = z.object({ listingId: z.uuid().optional() }).strict();

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const done = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

/**
 * Discover beacons (3D), counted like listing_viewed: same-origin page loads only, members by a
 * daily-salted hash of their id, guests by hx_vid, no IP. `{}` records discover_viewed (once per
 * actor per day); `{listingId}` records discover_item_viewed (once per listing per actor per day,
 * never for the seller). The database caps both per day.
 */
export async function POST(request: Request): Promise<Response> {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin !== null) return crossOrigin;
  if (!countableView(request.headers)) return done();
  const raw = await readCapped(request, 256);
  if (raw === null) return new Response(null, { status: 413 });
  const input = ViewInput.safeParse(parseJson(new TextDecoder().decode(raw)));
  if (!input.success) return new Response(null, { status: 400 });

  if (input.data.listingId === undefined) {
    const { actor, viewerId } = await viewActor();
    await recordEvent({ name: 'discover_viewed' }, { actor, viewerId });
    return done();
  }
  const view = await loadListingView(await sessionClient(), input.data.listingId, null);
  if (view?.kind !== 'listing' || view.inReview) return new Response(null, { status: 404 });
  if (view.isOwner) return done();
  const { actor, viewerId } = await viewActor();
  await recordEvent(
    { name: 'discover_item_viewed' },
    { listingId: view.listing.id, actor, viewerId },
  );
  return done();
}
