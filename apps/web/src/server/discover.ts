import 'server-only';
import {
  DEFAULT_RADIUS_MI,
  encodeCursor,
  filtersFor,
  parseFeedItems,
  parseListingQuery,
} from '@hucxter/contracts';
import type { FeedItem, ListingDetail, RadiusMi } from '@hucxter/contracts';
import { z } from 'zod';
import { attributeRows } from '@/lib/listing-attributes';
import type { AttributeRow } from '@/lib/listing-attributes';
import { searchListings } from '@/lib/listings';
import { findDepartment, getTaxonomy } from '@/lib/taxonomy';
import { loadMemberForDisplay } from '@/server/auth/member';
import { codeOf, logError } from '@/server/log';
import { loadListingView } from '@/server/listings/public';
import { playbackSource } from '@/server/media/playback';
import type { PlaybackSource } from '@/server/media/provider';
import { savedAmong } from '@/server/saves';
import { sessionClient } from '@/server/supabase-server';

/**
 * Discover feed (Brief 03 Milestone 3D): live listings within the viewer's radius, newest first,
 * through listings_nearby (radius allowlist, display points and distance buckets only) and the
 * stale-session-safe read path. Pages carry cards only; playback tokens are minted per item, for
 * the active and next items, by discoverItem().
 */
export const DISCOVER_PAGE_SIZE = 12;

export interface DiscoverPage {
  items: FeedItem[];
  nextCursor: string | null;
  /** The `?l=` item the feed starts at, when it is in the viewer's feed. */
  startId: string | null;
  /** `?l=` named an item that isn't in the viewer's feed (out of radius, sold, gone). */
  startMissing: boolean;
  /** The feed starts below the newest item, so "Previous" can't reach the top. */
  startedMidway: boolean;
}

// Newest first, including Pending ("someone's on the way"): real status only.
const FEED_QUERY = parseListingQuery({ status: 'include_pending' }, []);
const AFTER_ALL_IDS = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/**
 * A keyset cursor that starts the newest-first feed at a listing published at `postedAt`. Posted
 * times are rounded to milliseconds while the database keeps microseconds, so the cursor sits
 * 1 ms later: the listing is then on the page, possibly after a few items from that millisecond.
 */
export function startCursor(postedAt: string): string {
  const t = new Date(Date.parse(postedAt) + 1).toISOString();
  return encodeCursor({ k: 0, t, id: AFTER_ALL_IDS });
}

function feedItems(cards: { id: string }[]): FeedItem[] {
  return parseFeedItems(cards.map((listing) => ({ type: 'listing', id: listing.id, listing })));
}

export interface DiscoverViewer {
  zip: string | null;
  radiusMi: RadiusMi | undefined;
}

export async function discoverPage(
  viewer: DiscoverViewer,
  options: { after?: string | undefined; startAt?: string | undefined } = {},
): Promise<DiscoverPage> {
  const search = {
    query: FEED_QUERY,
    zip: viewer.zip,
    radiusMi: viewer.radiusMi ?? DEFAULT_RADIUS_MI,
    limit: DISCOVER_PAGE_SIZE,
  };
  const none = { startId: null, startMissing: false, startedMidway: false };
  if (options.after !== undefined) {
    const page = await searchListings({ ...search, after: options.after });
    return { items: feedItems(page.items), nextCursor: page.nextCursor, ...none };
  }

  const startAt = z.uuid().safeParse(options.startAt);
  if (!startAt.success || viewer.zip === null) {
    const page = await searchListings(search);
    return { items: feedItems(page.items), nextCursor: page.nextCursor, ...none };
  }

  const view = await loadListingView(await sessionClient(), startAt.data, viewer.zip).catch(
    (error: unknown) => {
      logError('discover_start_failed', { code: codeOf(error) });
      return null;
    },
  );
  const live =
    view?.kind === 'listing' && !view.inReview && view.mediaReady && view.listing.status !== 'sold';
  if (live) {
    const [from, newest] = await Promise.all([
      searchListings({ ...search, after: startCursor(view.listing.posted_at) }),
      searchListings({ ...search, limit: 1 }),
    ]);
    const index = from.items.findIndex((item) => item.id === startAt.data);
    if (index !== -1) {
      return {
        items: feedItems(from.items.slice(index)),
        nextCursor: from.nextCursor,
        startId: startAt.data,
        startMissing: false,
        startedMidway: newest.items[0]?.id !== startAt.data,
      };
    }
  }
  // Not in this viewer's feed: start at the newest; the page says so and links to the listing.
  const page = await searchListings(search);
  return {
    items: feedItems(page.items),
    nextCursor: page.nextCursor,
    startId: null,
    startMissing: true,
    startedMidway: false,
  };
}

export interface DiscoverItem {
  detail: ListingDetail;
  /** Labelled attributes for the details sheet (Condition first). */
  rows: AttributeRow[];
  saved: boolean;
  own: boolean;
  /** Signed playback for this item, or null when the video provider is unavailable. */
  source: PlaybackSource | null;
}

/**
 * One feed item's details and playback, or null when it is no longer in anyone's feed (sold,
 * deleted, removed, in review, not ready). Visibility comes from listing_public before any token
 * is signed. Database errors throw (the route answers 5xx, and the client may retry).
 */
export async function discoverItem(
  id: string,
  viewerZip: string | null,
): Promise<DiscoverItem | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const db = await sessionClient();
  const view = await loadListingView(db, id, viewerZip);
  if (view?.kind !== 'listing' || view.inReview || !view.mediaReady) return null;
  if (view.listing.status === 'sold') return null;
  const [source, member] = await Promise.all([
    view.mediaId === null
      ? Promise.resolve(null)
      : playbackSource(view.mediaId).catch((error: unknown) => {
          logError('playback_unavailable', { code: codeOf(error) });
          return null;
        }),
    loadMemberForDisplay(),
  ]);
  // Saves are member-only (RLS): guests and the owner never query them.
  const saved = member === null || view.isOwner ? new Set<string>() : await savedAmong(db, [id]);
  const department = findDepartment(await getTaxonomy(), view.listing.department_slug);
  const filters =
    department === undefined ? [] : filtersFor(department, view.listing.category_slug);
  return {
    detail: view.listing,
    rows: attributeRows(view.listing, filters),
    saved: saved.has(id),
    own: view.isOwner,
    source,
  };
}
