import { randomUUID } from 'node:crypto';
import type { TestInfo } from '@playwright/test';
import { deleteE2eUsers, localAdmin, testEmail } from './accounts';

/**
 * Listing fixtures for e2e, written straight into the LOCAL stack with the service role
 * (localAdmin refuses any non-local Supabase). The seller is a throwaway e2e account; deleting it
 * cascades the listing. Used where a spec needs a live listing without driving the sell flow
 * (the sell flow itself is covered by sell.spec.ts). The video ids are fake: with the fake video
 * provider (:3103) the page plays the local test video; elsewhere it shows "video unavailable".
 */
export interface SeedOptions {
  title?: string;
  priceCents?: number;
  status?: 'available' | 'pending' | 'sold';
  zip?: string;
  categorySlug?: string;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'for_parts';
  description?: string;
  needsReview?: boolean;
  /** Earlier prices, oldest first, each with how many days ago it took effect (D-45 tests). */
  priceHistory?: { priceCents: number; daysAgo: number }[];
  /** When the current price took effect, in days ago (default: now). */
  priceChangedDaysAgo?: number;
  /** When it went live, in days ago (default: now). */
  publishedDaysAgo?: number;
}

export interface SeededListing {
  id: string;
  sellerEmail: string;
  sellerId: string;
}

const DAY = 86_400_000;

async function check<T>(label: string, call: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error !== null && error !== undefined) {
    throw new Error(`${label}: ${JSON.stringify(error)}`);
  }
  return data;
}

export async function seedListing(
  testInfo: TestInfo,
  options: SeedOptions = {},
): Promise<SeededListing> {
  const db = localAdmin();
  const sellerEmail = testEmail(testInfo, 'seller');
  const created = await db.auth.admin.createUser({ email: sellerEmail, email_confirm: true });
  if (created.error !== null) throw new Error('could not create the fixture seller');
  const sellerId = created.data.user.id;
  await check(
    'profile',
    db
      .from('profiles')
      .update({
        display_name: 'Test Seller',
        home_zip: options.zip ?? '97205',
        age_attested_at: new Date().toISOString(),
      })
      .eq('id', sellerId),
  );
  const category = await check(
    'category',
    db
      .from('categories')
      .select('id')
      .eq('slug', options.categorySlug ?? 'furniture')
      .single(),
  );
  const history = options.priceHistory ?? [];
  const priceCents = options.priceCents ?? 4500;
  const publishedAt = new Date(Date.now() - (options.publishedDaysAgo ?? 0) * DAY).toISOString();
  const id = randomUUID();
  await check(
    'listing',
    db.from('listings').insert({
      id,
      seller_id: sellerId,
      category_id: (category as { id: string }).id,
      title: options.title ?? 'Oak bookshelf',
      description: options.description ?? 'Five shelves. Some wear on the top edge.',
      price_cents: history[0]?.priceCents ?? priceCents,
      condition: options.condition ?? 'good',
      pickup_zip: options.zip ?? '97205',
    }),
  );
  const mediaId = randomUUID();
  await check(
    'media',
    db.from('listing_media').insert({ id: mediaId, owner_id: sellerId, listing_id: id }),
  );
  await check(
    'media processing',
    db
      .from('listing_media')
      .update({
        status: 'processing',
        mux_upload_id: `fake-upload-${mediaId}`,
        mux_asset_id: `fake-asset-${mediaId}`,
      })
      .eq('id', mediaId),
  );
  await check(
    'media ready',
    db
      .from('listing_media')
      .update({ status: 'ready', mux_playback_id: `fake-playback-${mediaId}`, duration_s: 12 })
      .eq('id', mediaId),
  );
  await check(
    'publish',
    db
      .from('listings')
      .update({
        status: 'available',
        published_at: publishedAt,
        review_state: options.needsReview === true ? 'needs_review' : 'ok',
      })
      .eq('id', id),
  );
  if (options.status !== undefined && options.status !== 'available') {
    await check('status', db.from('listings').update({ status: options.status }).eq('id', id));
  }
  for (const point of history.slice(1)) {
    await check(
      'price',
      db.from('listings').update({ price_cents: point.priceCents }).eq('id', id),
    );
  }
  if (history.length > 0) {
    await check(
      'current price',
      db.from('listings').update({ price_cents: priceCents }).eq('id', id),
    );
    // Backdate the history the triggers just wrote: the oldest price and the first live row
    // take the first point's date, later prices their own.
    const prices = (await check(
      'price rows',
      db.from('listing_price_history').select('id').eq('listing_id', id).order('id'),
    )) as { id: number }[];
    const dates = [...history.map((p) => p.daysAgo), options.priceChangedDaysAgo ?? 0];
    for (const [i, row] of prices.entries()) {
      const daysAgo = dates[Math.min(i, dates.length - 1)] ?? 0;
      await check(
        'backdate price',
        db
          .from('listing_price_history')
          .update({ effective_from: new Date(Date.now() - daysAgo * DAY).toISOString() })
          .eq('id', row.id),
      );
    }
    // The draft row a day before the first price, the live row at it.
    const first = history[0]?.daysAgo ?? 0;
    const statuses = (await check(
      'status rows',
      db.from('listing_status_history').select('id').eq('listing_id', id).order('id'),
    )) as { id: number }[];
    for (const [i, row] of statuses.entries()) {
      const daysAgo = i === 0 ? first + 1 : first;
      await check(
        'backdate status',
        db
          .from('listing_status_history')
          .update({ changed_at: new Date(Date.now() - daysAgo * DAY).toISOString() })
          .eq('id', row.id),
      );
    }
  }
  return { id, sellerEmail, sellerId };
}

export async function deleteSeeded(listings: SeededListing[]): Promise<void> {
  await deleteE2eUsers(listings.map((l) => l.sellerEmail));
}
