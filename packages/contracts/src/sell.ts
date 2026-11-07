import { z } from 'zod';
import { ListingCondition } from './feed';
import { Zip } from './location';
import { CategorySlug } from './taxonomy';

/**
 * Sell flow and listing-management inputs (Brief 03C.1 §3.3, §3.6). Server actions parse these
 * before calling the database; the database re-checks ownership, transitions and limits.
 */

/** Video formats the sell flow accepts (hucxter-video-pipeline). */
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const VideoType = z.enum(VIDEO_TYPES);

/** Plain text only: control characters (except line breaks and tabs) are removed. */
export function plainText(max: number) {
  return z
    .string()
    .transform((value) =>
      value
        .replace(/\r\n?/g, '\n')
        .replace(/[^\P{Cc}\n\t]/gu, '')
        .trim(),
    )
    .pipe(z.string().max(max, `Keep it under ${max.toLocaleString('en-US')} characters.`));
}

export const ListingTitle = z
  .string()
  .transform((value) => value.replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(1, 'Add a title.')
      .max(80, 'Keep the title under 80 characters.')
      .refine((value) => !/[\p{Cc}]/u.test(value), 'Remove special characters.'),
  );

export const ListingDescription = plainText(2000);

/** Whole dollars, $0–$100,000. Free is 0. */
export const PriceDollars = z
  .number({ error: 'Enter a price in whole dollars.' })
  .int('Enter a price in whole dollars.')
  .min(0, 'Enter a price in whole dollars.')
  .max(100_000, 'Prices go up to $100,000.');

export const ListingAttributeValues = z.record(
  z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  z.union([z.string().max(80), z.number(), z.boolean()]),
);

export const ListingDetailsInput = z
  .object({
    listingId: z.uuid(),
    title: ListingTitle,
    categorySlug: CategorySlug,
    condition: ListingCondition,
    free: z.boolean(),
    priceDollars: PriceDollars,
    /** Checked against the category's own schema with `listingAttributesSchema`. */
    attributes: ListingAttributeValues,
    description: ListingDescription,
    pickupZip: Zip,
  })
  .strict()
  .transform((input) => ({ ...input, priceDollars: input.free ? 0 : input.priceDollars }));
export type ListingDetailsInput = z.infer<typeof ListingDetailsInput>;

export const ListingIdInput = z.object({ listingId: z.uuid() }).strict();

export const PublishInput = z.object({ listingId: z.uuid(), whenReady: z.boolean() }).strict();

export const OwnerStatus = z.enum(['pending', 'available', 'sold']);
export const StatusChangeInput = z.object({ listingId: z.uuid(), status: OwnerStatus }).strict();

export const UploadRequest = z
  .object({
    listingId: z.uuid(),
    type: VideoType,
    sizeBytes: z.number().int().positive(),
    /** Seconds, when the browser could read it (some can't for some formats). */
    durationSeconds: z.number().nonnegative().nullable(),
  })
  .strict();
export type UploadRequest = z.infer<typeof UploadRequest>;

export const UploadFailureReason = z.enum([
  'too_large',
  'too_long',
  'wrong_type',
  'network',
  'cancelled',
  'server',
  'processing',
]);
export type UploadFailureReason = z.infer<typeof UploadFailureReason>;

export const UploadEventInput = z.discriminatedUnion('name', [
  z.object({ name: z.literal('upload_started'), listingId: z.uuid() }).strict(),
  z.object({ name: z.literal('upload_completed'), listingId: z.uuid() }).strict(),
  z
    .object({ name: z.literal('upload_failed'), listingId: z.uuid(), reason: UploadFailureReason })
    .strict(),
]);

/** Report reasons (hucxter-trust-safety), in the order shown. */
export const REPORT_REASONS = [
  'prohibited_item',
  'scam',
  'counterfeit',
  'stolen_goods',
  'unsafe_meetup',
  'harassment',
  'minor_safety',
  'other',
] as const;
export const ReportReason = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReason>;

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  prohibited_item: 'It’s a prohibited item',
  scam: 'It looks like a scam',
  counterfeit: 'It’s counterfeit',
  stolen_goods: 'It might be stolen',
  unsafe_meetup: 'Unsafe meetup request',
  harassment: 'Harassment or hate',
  minor_safety: 'A child may be at risk',
  other: 'Something else',
};

export const ReportInput = z
  .object({
    targetType: z.literal('listing'),
    targetId: z.uuid(),
    reason: ReportReason,
    note: plainText(500),
  })
  .strict();
export type ReportInput = z.infer<typeof ReportInput>;

export const AdminRemoveInput = z.object({ listingId: z.uuid(), reason: plainText(500) }).strict();
export const AdminReportInput = z.object({ reportId: z.uuid() }).strict();
