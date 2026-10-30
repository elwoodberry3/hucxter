import { z } from 'zod';
import { ListingCard } from './feed';
import { CategorySlug } from './taxonomy';

/** Seller summary on a listing page. No ratings or reviews in Phase I. */
export const SellerSummary = z
  .object({
    display_name: z.string().min(1).max(40),
    member_since: z.iso.date(),
    verified: z.object({ phone: z.boolean(), email: z.boolean() }).strict(),
  })
  .strict();
export type SellerSummary = z.infer<typeof SellerSummary>;

/** A listing page (storefront-ia §5). Distances bucketed; never coordinates or addresses. */
export const ListingDetail = ListingCard.extend({
  description: z.string().max(2000),
  department_slug: CategorySlug,
  /** Validated against the category's attribute schema (`listingAttributesSchema`). */
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  seller: SellerSummary,
}).strict();
export type ListingDetail = z.infer<typeof ListingDetail>;
