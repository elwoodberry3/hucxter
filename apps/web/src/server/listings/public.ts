import 'server-only';
import { DistanceBucket, ListingCondition, priceDrop } from '@hucxter/contracts';
import type { ListingDetail, PriceDrop } from '@hucxter/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { avatarUrl } from '@/lib/avatar';

/**
 * One listing for /l/[id] through listing_public (definer; distance bucket only, never points).
 * Visible to everyone when live or sold, approved and with a ready video; to the owner at any
 * stage except deleted or removed. Returns null otherwise (the page 404s).
 */
const Row = z.object({
  id: z.uuid(),
  is_owner: z.boolean().nullable(),
  title: z.string().nullable(),
  description: z.string(),
  price_cents: z.number().int().nullable(),
  condition: ListingCondition.nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  status: z.enum(['draft', 'available', 'pending', 'sold']),
  review_state: z.enum(['ok', 'needs_review']),
  published_at: z.string().nullable(),
  created_at: z.string(),
  area_label: z.string().nullable(),
  state: z.string().nullable(),
  distance_bucket: DistanceBucket.nullable(),
  category_slug: z.string().nullable(),
  category_name: z.string().nullable(),
  department_slug: z.string().nullable(),
  department_name: z.string().nullable(),
  media_id: z.uuid().nullable(),
  media_status: z.enum(['awaiting_upload', 'processing', 'ready', 'errored', 'removed']).nullable(),
  seller_display_name: z.string().nullable(),
  seller_joined_at: z.string(),
  seller_phone_verified: z.boolean(),
  seller_items_sold: z.number().int(),
  seller_handle: z.string().nullable(),
  seller_avatar_path: z.string().nullable(),
  publish_when_ready: z.boolean().nullable(),
  pickup_zip: z.string().nullable(),
});

export type ListingView =
  | { kind: 'draft'; id: string }
  | {
      kind: 'listing';
      listing: ListingDetail;
      isOwner: boolean;
      inReview: boolean;
      mediaId: string | null;
      mediaReady: boolean;
    };

function monthOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export async function loadListingView(
  db: SupabaseClient,
  id: string,
  viewerZip: string | null,
): Promise<ListingView | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const result = await db.rpc('listing_public', { p_id: id, p_viewer_zip: viewerZip });
  if (result.error !== null) throw new Error(`listing_public:${result.error.code}`);
  const rows = z.array(Row).parse(result.data);
  const row = rows[0];
  if (row === undefined) return null;
  const isOwner = row.is_owner === true;
  if (row.status === 'draft') return isOwner ? { kind: 'draft', id: row.id } : null;
  if (
    row.title === null ||
    row.price_cents === null ||
    row.condition === null ||
    row.area_label === null ||
    row.state === null ||
    row.category_slug === null ||
    row.category_name === null ||
    row.department_slug === null ||
    row.department_name === null ||
    row.published_at === null
  ) {
    return null;
  }
  return {
    kind: 'listing',
    isOwner,
    inReview: row.review_state === 'needs_review',
    mediaId: row.media_id,
    mediaReady: row.media_status === 'ready',
    listing: {
      id: row.id,
      title: row.title,
      price_cents: row.price_cents,
      condition: row.condition,
      status: row.status,
      distance_bucket: row.distance_bucket,
      area_label: row.area_label,
      state: row.state,
      posted_at: new Date(row.published_at).toISOString(),
      poster_url: row.media_id === null ? '/icon-512.png' : `/media/poster/${row.id}`,
      category_slug: row.category_slug,
      category_name: row.category_name,
      department_slug: row.department_slug,
      department_name: row.department_name,
      description: row.description,
      attributes: row.attributes,
      is_demo: false,
      seller: {
        display_name: row.seller_display_name ?? 'Hucxter member',
        joined_month: monthOf(row.seller_joined_at),
        phone_verified: row.seller_phone_verified,
        items_sold: row.seller_items_sold,
        handle: row.seller_handle,
        avatar_url: avatarUrl(row.seller_avatar_path),
      },
    },
  };
}

const PricePoints = z.array(
  z.object({
    kind: z.enum(['price', 'status']),
    at: z.string(),
    price_cents: z.number().int().nullable(),
    live: z.boolean().nullable(),
  }),
);

/** The D-45 price drop for a listing, or null. */
export async function loadPriceDrop(db: SupabaseClient, id: string): Promise<PriceDrop | null> {
  const result = await db.rpc('listing_price_points', { p_id: id });
  if (result.error !== null) return null;
  const points = PricePoints.safeParse(result.data);
  if (!points.success) return null;
  const prices = points.data.flatMap((p) =>
    p.kind === 'price' && p.price_cents !== null
      ? [{ at: new Date(p.at), priceCents: p.price_cents }]
      : [],
  );
  const statuses = points.data.flatMap((p) =>
    p.kind === 'status' && p.live !== null ? [{ at: new Date(p.at), live: p.live }] : [],
  );
  return priceDrop(prices, statuses);
}

/** Owner-only, real view count (deduplicated per viewer per day; the owner's own views excluded). */
export async function loadOwnerViewCount(db: SupabaseClient, id: string): Promise<number | null> {
  const result = await db.rpc('listing_owner_view_count', { p_id: id });
  if (result.error !== null) return null;
  const count = z.coerce.number().int().min(0).safeParse(result.data);
  return count.success ? count.data : null;
}
