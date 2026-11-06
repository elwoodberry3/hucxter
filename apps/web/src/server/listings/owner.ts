import 'server-only';
import type { ListingCondition } from '@hucxter/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * The member's own listings, read under RLS (listings_select_own: own rows, not deleted; no point
 * columns). Used by /sell drafts and /listings.
 */
const OwnListingRow = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  description: z.string(),
  price_cents: z.number().int().nullable(),
  condition: z.string().nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  status: z.enum(['draft', 'available', 'pending', 'sold']),
  review_state: z.enum(['ok', 'needs_review']),
  pickup_zip: z.string().nullable(),
  area_label: z.string().nullable(),
  state: z.string().nullable(),
  publish_when_ready: z.boolean(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  removed_at: z.string().nullable(),
  category: z
    .object({ slug: z.string(), parent: z.object({ slug: z.string() }).nullable() })
    .nullable(),
});

const MediaRow = z.object({
  id: z.uuid(),
  listing_id: z.uuid(),
  status: z.enum(['awaiting_upload', 'processing', 'ready', 'errored', 'removed']),
  duration_s: z.number().nullable(),
});

export type MediaStatus = z.infer<typeof MediaRow>['status'];

export interface OwnListing {
  id: string;
  title: string | null;
  description: string;
  priceCents: number | null;
  condition: ListingCondition | null;
  attributes: Record<string, string | number | boolean>;
  status: 'draft' | 'available' | 'pending' | 'sold';
  reviewState: 'ok' | 'needs_review';
  pickupZip: string | null;
  areaLabel: string | null;
  state: string | null;
  publishWhenReady: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  removed: boolean;
  categorySlug: string | null;
  departmentSlug: string | null;
  media: { id: string; status: MediaStatus; durationSeconds: number | null } | null;
}

const COLUMNS =
  'id, title, description, price_cents, condition, attributes, status, review_state, pickup_zip, area_label, state, publish_when_ready, published_at, created_at, updated_at, removed_at, category:categories!category_id(slug, parent:parent_id(slug))';

function toOwnListing(
  row: z.infer<typeof OwnListingRow>,
  media: z.infer<typeof MediaRow> | undefined,
): OwnListing {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    condition: row.condition as ListingCondition | null,
    attributes: row.attributes,
    status: row.status,
    reviewState: row.review_state,
    pickupZip: row.pickup_zip,
    areaLabel: row.area_label,
    state: row.state,
    publishWhenReady: row.publish_when_ready,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    removed: row.removed_at !== null,
    categorySlug: row.category?.slug ?? null,
    departmentSlug: row.category?.parent?.slug ?? null,
    media:
      media === undefined
        ? null
        : { id: media.id, status: media.status, durationSeconds: media.duration_s },
  };
}

async function mediaFor(session: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, z.infer<typeof MediaRow>>();
  const { data, error } = await session
    .from('listing_media')
    .select('id, listing_id, status, duration_s')
    .in('listing_id', ids);
  if (error !== null) throw new Error(`own_media:${error.code}`);
  return new Map(
    z
      .array(MediaRow)
      .parse(data)
      .map((m) => [m.listing_id, m]),
  );
}

export async function loadOwnListing(
  session: SupabaseClient,
  id: string,
): Promise<OwnListing | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await session.from('listings').select(COLUMNS).eq('id', id).maybeSingle();
  if (error !== null) throw new Error(`own_listing:${error.code}`);
  if (data === null) return null;
  const row = OwnListingRow.parse(data);
  return toOwnListing(row, (await mediaFor(session, [row.id])).get(row.id));
}

/** Newest first, at most `limit` (keyset on updated_at, id). */
export async function loadOwnListings(
  session: SupabaseClient,
  { limit = 50, before }: { limit?: number; before?: { updatedAt: string; id: string } } = {},
): Promise<OwnListing[]> {
  let query = session
    .from('listings')
    .select(COLUMNS)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(limit, 100));
  if (before !== undefined) {
    if (
      !z.iso.datetime({ offset: true }).safeParse(before.updatedAt).success ||
      !z.uuid().safeParse(before.id).success
    ) {
      throw new Error('own_listings:bad_cursor');
    }
    query = query.or(
      `updated_at.lt.${before.updatedAt},and(updated_at.eq.${before.updatedAt},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query;
  if (error !== null) throw new Error(`own_listings:${error.code}`);
  const rows = z.array(OwnListingRow).parse(data);
  const media = await mediaFor(
    session,
    rows.map((r) => r.id),
  );
  return rows.map((row) => toOwnListing(row, media.get(row.id)));
}
