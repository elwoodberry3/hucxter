import { z } from 'zod';
import { DistanceBucket, ListingCard } from './feed';
import { CategorySlug } from './taxonomy';
import { Handle } from './handle';

/**
 * Seller card on a listing page (Brief 03C.1 §3.4, D-46): verified facts only. No ratings, reviews,
 * follower counts or email badge.
 */
export const SellerSummary = z
  .object({
    display_name: z.string().min(1).max(40),
    /** First day of the month the seller joined ("Joined Nov 2026"). */
    joined_month: z.iso.date(),
    phone_verified: z.boolean(),
    items_sold: z.number().int().min(0),
    /** Public @handle for the profile link (3C.2); absent for demo listings. */
    handle: Handle.nullable().optional(),
    /** Public photo URL, or null for initials. */
    avatar_url: z.url().nullable().optional(),
  })
  .strict();
export type SellerSummary = z.infer<typeof SellerSummary>;

/** A listing page (storefront-ia §5). Distances bucketed; never coordinates or addresses. */
export const ListingDetail = ListingCard.extend({
  /** Null when the viewer is more than 100 mi away (or their ZIP is unknown). */
  distance_bucket: DistanceBucket.nullable(),
  state: z.string().regex(/^[A-Z]{2}$/),
  description: z.string().max(2000),
  category_name: z.string().min(1).max(60),
  department_slug: CategorySlug,
  department_name: z.string().min(1).max(60),
  /** Validated against the category's attribute schema (`listingAttributesSchema`). */
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  seller: SellerSummary,
}).strict();
export type ListingDetail = z.infer<typeof ListingDetail>;
