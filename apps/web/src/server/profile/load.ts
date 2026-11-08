import 'server-only';
import { Handle, ListingCondition } from '@hucxter/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { readOrGuest } from '@/server/supabase-server';
import { avatarUrl } from '@/lib/avatar';

/**
 * Profile pages (Brief 03C.2 §4.2) through definer functions: profile_by_handle (public facts only,
 * never ids, home ZIP or area) and profile_listings / my_saved_listings (keyset pages). Owner-only
 * fields (drafts, review state, views) come back only when the session is the profile's owner.
 */

export const PROFILE_TABS = ['listings', 'sold', 'saved'] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export const OWNER_FILTERS = ['all', 'live', 'pending', 'drafts', 'review'] as const;
export type OwnerFilter = (typeof OWNER_FILTERS)[number];

export const PROFILE_SORTS = ['newest', 'oldest', 'price_asc', 'price_desc'] as const;
export type ProfileSort = (typeof PROFILE_SORTS)[number];

export const PROFILE_PAGE_SIZE = 24;

const ProfileRow = z.object({
  handle: z.string(),
  display_name: z.string(),
  bio: z.string(),
  avatar_path: z.string().nullable(),
  joined_at: z.string(),
  phone_verified: z.boolean(),
  listed_count: z.number().int(),
  sold_count: z.number().int(),
  is_owner: z.boolean(),
});

export interface Profile {
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  /** First day of the joined month (YYYY-MM-01). */
  joinedMonth: string;
  phoneVerified: boolean;
  listedCount: number;
  soldCount: number;
  isOwner: boolean;
}

/** The profile for a handle, or null (unknown, invalid, deleted, or onboarding not finished). */
export async function loadProfile(db: SupabaseClient, handle: string): Promise<Profile | null> {
  if (!Handle.safeParse(handle).success) return null;
  const result = await readOrGuest(db, 'profile_by_handle', (client) =>
    client.rpc('profile_by_handle', { p_handle: handle }),
  );
  if (result.error !== null) throw new Error(`profile_by_handle:${result.error.code}`);
  const row = z.array(ProfileRow).parse(result.data)[0];
  if (row === undefined) return null;
  return {
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: avatarUrl(row.avatar_path),
    joinedMonth: `${row.joined_at.slice(0, 7)}-01`,
    phoneVerified: row.phone_verified,
    listedCount: row.listed_count,
    soldCount: row.sold_count,
    isOwner: row.is_owner,
  };
}

const Cursor = z.object({ k: z.number(), id: z.uuid() }).strict();
type Cursor = z.infer<typeof Cursor>;

export function encodeProfileCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeProfileCursor(value: string | undefined): Cursor | null {
  if (value === undefined || value.length > 200) return null;
  try {
    const parsed = Cursor.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const TileRow = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  price_cents: z.number().int().nullable(),
  condition: z.string().nullable(),
  status: z.enum(['draft', 'available', 'pending', 'sold']),
  review_state: z.enum(['ok', 'needs_review']).nullable().optional(),
  removed: z.boolean().optional(),
  media_status: z
    .enum(['awaiting_upload', 'processing', 'ready', 'errored', 'removed'])
    .nullable()
    .optional(),
  views: z.number().int().nullable().optional(),
  cursor: Cursor,
});

export type TileState = 'live' | 'draft' | 'review' | 'removed';

export interface ProfileTile {
  id: string;
  title: string | null;
  priceCents: number | null;
  condition: ListingCondition | null;
  status: 'draft' | 'available' | 'pending' | 'sold';
  /** Where an owner's listing stands; always 'live' for other viewers. */
  state: TileState;
  /** Owner only: a draft whose video is still processing. */
  processing: boolean;
  /** A buyer could see it, so the poster route serves it. */
  hasPoster: boolean;
  /** Owner only: real views from listing_viewed events. */
  views: number | null;
}

export interface TilePage {
  items: ProfileTile[];
  nextCursor: string | null;
}

function toTile(row: z.infer<typeof TileRow>): ProfileTile {
  const condition = ListingCondition.safeParse(row.condition);
  const state: TileState =
    row.removed === true
      ? 'removed'
      : row.status === 'draft'
        ? 'draft'
        : row.review_state === 'needs_review'
          ? 'review'
          : 'live';
  const mediaReady =
    row.media_status === undefined || row.media_status === null
      ? state === 'live'
      : row.media_status === 'ready';
  return {
    id: row.id,
    title: row.title,
    priceCents: row.price_cents,
    condition: condition.success ? condition.data : null,
    status: row.status,
    state,
    processing: state === 'draft' && row.media_status === 'processing',
    hasPoster: state === 'live' && mediaReady,
    views: row.views ?? null,
  };
}

function page(rows: z.infer<typeof TileRow>[], limit: number): TilePage {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(toTile),
    nextCursor: rows.length > limit && last !== undefined ? encodeProfileCursor(last.cursor) : null,
  };
}

/** One page of a profile's listings: 'listings' and 'sold' for everyone, owner filters for the owner. */
export async function loadProfileListings(
  db: SupabaseClient,
  input: {
    handle: string;
    filter: 'listings' | 'sold' | OwnerFilter;
    sort: ProfileSort;
    after: Cursor | null;
    limit?: number;
  },
): Promise<TilePage> {
  const limit = input.limit ?? PROFILE_PAGE_SIZE;
  const result = await readOrGuest(db, 'profile_listings', (client) =>
    client.rpc('profile_listings', {
      p_handle: input.handle,
      p_filter: input.filter,
      p_sort: input.sort,
      p_cursor: input.after,
      p_limit: limit + 1,
    }),
  );
  if (result.error !== null) throw new Error(`profile_listings:${result.error.code}`);
  return page(z.array(TileRow).parse(result.data), limit);
}

/** One page of the signed-in member's saves (live listings only). */
export async function loadSavedListings(
  db: SupabaseClient,
  input: { sort: ProfileSort; after: Cursor | null; limit?: number },
): Promise<TilePage> {
  const limit = input.limit ?? PROFILE_PAGE_SIZE;
  const result = await db.rpc('my_saved_listings', {
    p_sort: input.sort,
    p_cursor: input.after,
    p_limit: limit + 1,
  });
  if (result.error !== null) throw new Error(`my_saved_listings:${result.error.code}`);
  return page(z.array(TileRow).parse(result.data), limit);
}
