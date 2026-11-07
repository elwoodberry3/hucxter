import 'server-only';
import type { ListingCard } from '@hucxter/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { loadMemberForDisplay } from '@/server/auth/member';

const SavedRow = z.object({ listing_id: z.uuid() });
const OwnRow = z.object({ id: z.uuid() });

/** Which of these listing ids the signed-in viewer saved (RLS: own rows only). */
export async function savedAmong(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await db
    .from('saved_listings')
    .select('listing_id')
    .in('listing_id', ids);
  if (error !== null) {
    console.error('saved_ids_failed');
    return new Set();
  }
  return new Set(
    z
      .array(SavedRow)
      .parse(data)
      .map((row) => row.listing_id),
  );
}

/**
 * Marks cards the signed-in viewer saved or sells, from two RLS reads (own saves, own listings).
 * Guests get the cards unchanged. A failed read leaves the flags off rather than failing the page.
 */
export async function markViewerCards(
  db: SupabaseClient,
  items: ListingCard[],
): Promise<ListingCard[]> {
  if (items.length === 0) return items;
  const member = await loadMemberForDisplay();
  if (member === null) return items;
  const ids = items.map((item) => item.id);
  const [saved, own] = await Promise.all([
    db.from('saved_listings').select('listing_id').in('listing_id', ids),
    db.from('listings').select('id').in('id', ids),
  ]);
  if (saved.error !== null || own.error !== null) {
    console.error('viewer_cards_failed');
    return items;
  }
  const savedIds = new Set(
    z
      .array(SavedRow)
      .parse(saved.data)
      .map((row) => row.listing_id),
  );
  const ownIds = new Set(
    z
      .array(OwnRow)
      .parse(own.data)
      .map((row) => row.id),
  );
  return items.map((item) => ({ ...item, saved: savedIds.has(item.id), own: ownIds.has(item.id) }));
}
