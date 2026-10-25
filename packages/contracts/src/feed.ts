import { z } from 'zod';
import { CategorySlug } from './taxonomy';

/** Same-origin relative URL. Images must come from 'self' under the CSP. */
const RelativePath = z
  .string()
  .max(300)
  .regex(/^\/(?![/\\])[^\s]*$/, 'Must be a same-origin path');

export const ListingStatus = z.enum(['available', 'pending', 'sold']);
export type ListingStatus = z.infer<typeof ListingStatus>;

export const ListingCondition = z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']);
export type ListingCondition = z.infer<typeof ListingCondition>;

/** Distances are bucketed, never exact (hucxter-geo-radius rule 3). */
export const DistanceBucket = z.enum([
  '<1 mi',
  '1–5 mi',
  '5–10 mi',
  '10–25 mi',
  '25–50 mi',
  '50–100 mi',
]);
export type DistanceBucket = z.infer<typeof DistanceBucket>;

/** A listing as shown in grids and rails. No coordinates, ever. */
export const ListingCard = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(80),
    price_cents: z.number().int().min(0),
    condition: ListingCondition,
    status: ListingStatus,
    distance_bucket: DistanceBucket,
    area_label: z.string().min(1).max(60),
    posted_at: z.iso.datetime(),
    poster_url: RelativePath,
    category_slug: CategorySlug,
    /** Demo fixtures only (never in production). Rendered with a visible "Demo" label. */
    is_demo: z.boolean().default(false),
  })
  .strict();
export type ListingCard = z.infer<typeof ListingCard>;

/** Phase II. Defined so clients can skip it safely today. */
export const CreatorPostCard = z.object({ id: z.uuid(), title: z.string().max(80) }).strict();

export const SponsoredCard = z
  .object({
    sponsor: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('house'), name: z.literal('Hucxter') }),
      z.object({ kind: z.literal('advertiser'), name: z.string().min(1).max(60) }),
    ]),
    headline: z.string().min(1).max(80),
    body: z.string().min(1).max(160),
    cta_label: z.string().min(1).max(30),
    href: RelativePath,
    art_key: z.string().regex(/^[a-z0-9-]+$/),
  })
  .strict();
export type SponsoredCard = z.infer<typeof SponsoredCard>;

/**
 * Typed feed envelope (hucxter-event-taxonomy §1). Phase I emits `listing` items plus, on the home
 * page, one house promo as `sponsored` labeled "Promoted by Hucxter" (D-30). Never a fake ad.
 */
export const FeedItem = z.discriminatedUnion('type', [
  z.object({ type: z.literal('listing'), id: z.string().min(1), listing: ListingCard }).strict(),
  z
    .object({ type: z.literal('creator_post'), id: z.string().min(1), post: CreatorPostCard })
    .strict(),
  z
    .object({
      type: z.literal('sponsored'),
      id: z.string().min(1),
      sponsored: SponsoredCard,
      disclosure: z.enum(['Sponsored', 'Promoted by Hucxter']),
      why_shown: z.string().min(1).max(200),
    })
    .strict()
    .refine(
      (item) =>
        (item.sponsored.sponsor.kind === 'house') === (item.disclosure === 'Promoted by Hucxter'),
      { message: 'House promos are labeled "Promoted by Hucxter"; advertiser items "Sponsored"' },
    ),
]);
export type FeedItem = z.infer<typeof FeedItem>;

/** Parses feed items, skipping unknown or malformed ones so clients never crash on new types. */
export function parseFeedItems(items: readonly unknown[]): FeedItem[] {
  return items.flatMap((item) => {
    const parsed = FeedItem.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function formatPrice(priceCents: number): string {
  if (priceCents === 0) return 'Free';
  const dollars = priceCents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  });
}

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  for_parts: 'For parts',
};
