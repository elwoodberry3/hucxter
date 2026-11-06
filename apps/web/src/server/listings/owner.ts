import 'server-only';
import { CONDITION_LABELS } from '@hucxter/contracts';
import type { ListingCondition } from '@hucxter/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { DetailsValues } from '@/components/sell/details-form';

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

/** /listings tabs (Brief 03C.1 §3.6). Every own listing is in exactly one. */
export const OWN_TABS = ['drafts', 'processing', 'live', 'review', 'sold'] as const;
export type OwnTab = (typeof OWN_TABS)[number];

export interface OwnCursor {
  updatedAt: string;
  id: string;
}

export function encodeOwnCursor(cursor: OwnCursor): string {
  return Buffer.from(`${cursor.updatedAt}|${cursor.id}`).toString('base64url');
}

export function decodeOwnCursor(value: string | undefined): OwnCursor | null {
  if (value === undefined || value.length > 200) return null;
  const [updatedAt, id] = Buffer.from(value, 'base64url').toString().split('|');
  if (
    !z.iso.datetime({ offset: true }).safeParse(updatedAt).success ||
    !z.uuid().safeParse(id).success
  ) {
    return null;
  }
  return { updatedAt: updatedAt ?? '', id: id ?? '' };
}

/**
 * One tab of the member's listings, newest edit first, keyset on (updated_at, id).
 * - drafts: not published, video not processing
 * - processing: not published, video processing (incl. "Publish when ready")
 * - live: available or pending, approved, not removed
 * - review: published but waiting for review, or removed by Hucxter
 * - sold
 */
export async function loadOwnListings(
  session: SupabaseClient,
  {
    tab,
    limit = 20,
    before,
  }: { tab: OwnTab; limit?: number; before?: OwnCursor | null | undefined },
): Promise<{ items: OwnListing[]; nextCursor: string | null }> {
  const pageSize = Math.min(Math.max(limit, 1), 50);
  // Video-processing drafts: an inner join for the tab, an anti-join (no such row) for Drafts.
  const columns =
    tab === 'processing'
      ? `${COLUMNS}, processing:listing_media!inner(status)`
      : tab === 'drafts'
        ? `${COLUMNS}, processing:listing_media(status)`
        : COLUMNS;
  let query = session
    .from('listings')
    .select(columns)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);
  const keyset =
    before === null || before === undefined
      ? null
      : `updated_at.lt."${before.updatedAt}",and(updated_at.eq."${before.updatedAt}",id.lt.${before.id})`;
  switch (tab) {
    case 'drafts':
      query = query
        .eq('status', 'draft')
        .eq('processing.status', 'processing')
        .is('processing', null);
      break;
    case 'processing':
      query = query.eq('status', 'draft').eq('processing.status', 'processing');
      break;
    case 'live':
      query = query
        .in('status', ['available', 'pending'])
        .eq('review_state', 'ok')
        .is('removed_at', null);
      break;
    case 'review':
      query = query.neq('status', 'draft');
      break;
    case 'sold':
      query = query.eq('status', 'sold').eq('review_state', 'ok').is('removed_at', null);
      break;
  }
  // One `or` parameter: the review condition and the keyset combined.
  const review = 'review_state.eq.needs_review,removed_at.not.is.null';
  if (tab === 'review') {
    query = query.or(keyset === null ? review : `and(or(${review}),or(${keyset}))`);
  } else if (keyset !== null) {
    query = query.or(keyset);
  }
  const { data, error } = await query;
  if (error !== null) throw new Error(`own_listings:${error.code}`);
  const rows = z.array(OwnListingRow).parse(data);
  const page = rows.slice(0, pageSize);
  const media = await mediaFor(
    session,
    page.map((r) => r.id),
  );
  const last = page.at(-1);
  return {
    items: page.map((row) => toOwnListing(row, media.get(row.id))),
    nextCursor:
      rows.length > pageSize && last !== undefined
        ? encodeOwnCursor({ updatedAt: last.updated_at, id: last.id })
        : null,
  };
}

/** The details form's values for an own listing (/sell drafts and /listings/[id]/edit). */
export function ownDetailsValues(own: OwnListing, fallbackZip: string | null): DetailsValues {
  return {
    title: own.title ?? '',
    departmentSlug: own.departmentSlug ?? '',
    categorySlug: own.categorySlug ?? '',
    condition: own.condition !== null && own.condition in CONDITION_LABELS ? own.condition : '',
    free: own.priceCents === 0,
    price: own.priceCents === null || own.priceCents === 0 ? '' : String(own.priceCents / 100),
    attributes: own.attributes,
    description: own.description,
    pickupZip: own.pickupZip ?? fallbackZip ?? '',
  };
}

/** "Portland, OR" for an own listing's pickup area, or null. */
export function ownAreaLabel(own: OwnListing): string | null {
  if (own.areaLabel === null) return null;
  return own.state === null ? own.areaLabel : `${own.areaLabel}, ${own.state}`;
}
