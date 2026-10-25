import 'server-only';
import type { ListingCard, ListingQuery } from '@hucxter/contracts';

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
  limit: number;
  after?: string;
}

/**
 * Listing search. There is no listings table until Brief 04 (feed_local + keyset pagination), so
 * this honestly returns nothing. It never returns placeholder or demo listings.
 */
// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars -- becomes a database call in Brief 04
export async function searchListings(_search: ListingSearch): Promise<ListingPage> {
  return { items: [], nextCursor: null };
}
