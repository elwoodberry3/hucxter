import 'server-only';
import {
  DEFAULT_RADIUS_MI,
  ListingCard,
  decodeCursor,
  encodeCursor,
  filtersFor,
  parseListingQuery,
} from '@hucxter/contracts';
import type { ListingQuery, RadiusMi, RawSearchParams } from '@hucxter/contracts';
import { markViewerCards } from '@/server/saves';
import { sessionClient } from '@/server/supabase-server';
import { findDepartment, getTaxonomy } from './taxonomy';
import { getViewerLocation } from './viewer-location';

export interface ListingPage {
  items: ListingCard[];
  /** Keyset cursor for "Load more"; null when there are no more results. */
  nextCursor: string | null;
}

export interface ListingSearch {
  query: ListingQuery;
  departmentSlug?: string;
  subcategorySlug?: string;
  zip: string | null;
  /** The viewer's radius; the query's distance filter overrides it. */
  radiusMi: RadiusMi;
  limit: number;
  after?: string | undefined;
}

const MAX_LIMIT = 49; // listings_nearby returns at most 50; one extra row tells us there's more.

interface NearbyRow {
  id: unknown;
  title: unknown;
  price_cents: unknown;
  condition: unknown;
  status: unknown;
  distance_bucket: unknown;
  area_label: unknown;
  published_at: unknown;
  category_slug: unknown;
  cursor: unknown;
}

function toCard(row: NearbyRow): ListingCard | null {
  const posted = typeof row.published_at === 'string' ? new Date(row.published_at) : null;
  const parsed = ListingCard.safeParse({
    id: row.id,
    title: row.title,
    price_cents: row.price_cents,
    condition: row.condition,
    status: row.status,
    distance_bucket: row.distance_bucket,
    area_label: row.area_label,
    posted_at: posted === null || Number.isNaN(posted.getTime()) ? null : posted.toISOString(),
    // Same-origin poster route: it signs a short-lived thumbnail after a visibility check.
    poster_url: `/media/poster/${String(row.id)}`,
    category_slug: row.category_slug,
  });
  return parsed.success ? parsed.data : null;
}

/** The filter object listings_nearby reads (prices in cents). */
export function nearbyFilters(query: ListingQuery): Record<string, unknown> {
  return {
    sort: query.sort,
    ...(query.posted === 'any' ? {} : { posted: query.posted }),
    ...(query.conditions.length === 0 ? {} : { conditions: query.conditions }),
    ...(query.priceMin === undefined ? {} : { price_min: query.priceMin * 100 }),
    ...(query.priceMax === undefined ? {} : { price_max: query.priceMax * 100 }),
    ...(query.free ? { free: true } : {}),
    ...(query.status === 'include_pending' ? { include_pending: true } : {}),
    ...(Object.keys(query.attributes).length === 0 ? {} : { attributes: query.attributes }),
  };
}

/**
 * Live listings near the viewer (listings_nearby: radius allowlist, display points only, keyset
 * pagination). No location means no results; it never returns placeholder or demo listings.
 */
export async function searchListings(search: ListingSearch): Promise<ListingPage> {
  if (search.zip === null) return { items: [], nextCursor: null };
  const limit = Math.min(Math.max(search.limit, 1), MAX_LIMIT);
  const cursor = decodeCursor(search.after);
  const supabase = await sessionClient();
  const result = await supabase.rpc('listings_nearby', {
    p_zip: search.zip,
    p_radius_mi: search.query.distanceMi ?? search.radiusMi,
    p_department: search.departmentSlug ?? null,
    p_subcategory: search.subcategorySlug ?? null,
    p_query: search.query.q ?? null,
    p_filters: nearbyFilters(search.query),
    p_cursor: cursor,
    p_limit: limit + 1,
  });
  if (result.error !== null) {
    // Discovery degrades to an empty page (the designed empty state), never a broken one.
    console.error(`listings_nearby_failed:${result.error.code}`);
    return { items: [], nextCursor: null };
  }
  const data: unknown = result.data;
  const rows = Array.isArray(data) ? (data as NearbyRow[]) : [];
  const page = rows.slice(0, limit);
  const items = await markViewerCards(
    supabase,
    page.flatMap((row) => toCard(row) ?? []),
  );
  const last = page.at(-1);
  const next = rows.length > limit && last !== undefined ? cursorFromRow(last.cursor) : null;
  return { items, nextCursor: next };
}

function cursorFromRow(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const { k, t, id } = value as Record<string, unknown>;
  if (typeof k !== 'number' || typeof t !== 'string' || typeof id !== 'string') return null;
  return encodeCursor({ k, t, id });
}

export interface ResultsScope {
  departmentSlug?: string | undefined;
  subcategorySlug?: string | undefined;
}

export const RESULTS_PAGE_SIZE = 24;

/**
 * One page of category or search results for the current viewer: the scope's filters parsed
 * from the URL, the viewer's location and radius. Used by the pages and by "Load more".
 */
export async function resultsPage(
  scope: ResultsScope,
  searchParams: RawSearchParams,
): Promise<ListingPage & { query: ListingQuery }> {
  const [taxonomy, location] = await Promise.all([getTaxonomy(), getViewerLocation()]);
  const department =
    scope.departmentSlug === undefined ? undefined : findDepartment(taxonomy, scope.departmentSlug);
  const filters = department === undefined ? [] : filtersFor(department, scope.subcategorySlug);
  const query = parseListingQuery(searchParams, filters);
  const after = Array.isArray(searchParams.after) ? searchParams.after[0] : searchParams.after;
  const page = await searchListings({
    query,
    ...(department === undefined ? {} : { departmentSlug: department.slug }),
    ...(scope.subcategorySlug === undefined ? {} : { subcategorySlug: scope.subcategorySlug }),
    zip: location?.zip ?? null,
    radiusMi: location?.radiusMi ?? DEFAULT_RADIUS_MI,
    limit: RESULTS_PAGE_SIZE,
    after,
  });
  return { ...page, query };
}
