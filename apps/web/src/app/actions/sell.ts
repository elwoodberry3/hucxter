'use server';

import {
  ListingDetailsInput,
  ListingIdInput,
  PublishInput,
  UploadEventInput,
  UploadRequest,
  filtersFor,
  listingAttributesSchema,
} from '@hucxter/contracts';
import type { ServerEvent } from '@hucxter/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mediaConfig } from '@/lib/env';
import { getTaxonomy } from '@/lib/taxonomy';
import { loadMember } from '@/server/auth/member';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { recordEvent } from '@/server/events';
import { loadOwnListing } from '@/server/listings/owner';
import type { MediaStatus } from '@/server/listings/owner';
import { prohibitedMatches } from '@/server/listings/prohibited';
import { beginUpload } from '@/server/media/uploads';
import { sessionClient } from '@/server/supabase-server';

/**
 * Sell flow actions (Brief 03C.1 §3.3). Each one checks the Origin, then that the caller is a
 * verified member, then parses its input with contracts; the database functions re-check
 * ownership, transitions and rate limits (single write path, CLAUDE.md rule 3).
 */
export type SellError = { status: 'error'; message: string; fields?: Record<string, string> };
export type SellLimited = { status: 'limited'; retryAfter: number; message: string };

const VERIFY_FIRST = 'Finish setting up your account to sell.';
const NOT_FOUND = 'We couldn’t find that listing.';

function limited(retryAfter: number): SellLimited {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  const wait =
    minutes >= 120 ? `${String(Math.ceil(minutes / 60))} hours` : `${String(minutes)} minutes`;
  return {
    status: 'limited',
    retryAfter,
    message: `You’ve reached the limit for now. Try again in about ${wait}.`,
  };
}

async function verifiedUserId(): Promise<string | SellError> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  try {
    const member = await loadMember();
    if (member === null || !member.verified) return { status: 'error', message: VERIFY_FIRST };
    return member.userId;
  } catch {
    return { status: 'error', message: GENERIC_ERROR };
  }
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Step 1: a new draft (listings-per-day limit). */
export async function createDraft(): Promise<
  { status: 'ok'; listingId: string } | SellError | SellLimited
> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return userId;
  const supabase = await sessionClient();
  const created = await supabase.rpc('listing_create_draft');
  const data: unknown = created.data;
  if (created.error !== null) return { status: 'error', message: GENERIC_ERROR };
  const result = z
    .union([z.object({ listing_id: z.uuid() }), z.object({ retry_after: z.number().int() })])
    .safeParse(data);
  if (!result.success) return { status: 'error', message: GENERIC_ERROR };
  if ('retry_after' in result.data) return limited(result.data.retry_after);
  await recordEvent({ name: 'sell_started' }, { listingId: result.data.listing_id, actor: userId });
  return { status: 'ok', listingId: result.data.listing_id };
}

/**
 * Step 2: a direct-upload URL for the draft's video. The browser already checked type, size
 * and duration; they're re-checked here and again on the `ready` webhook (duration).
 */
export async function startUpload(
  input: unknown,
): Promise<{ status: 'ok'; uploadUrl: string } | SellError | SellLimited> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return userId;
  const parsed = UploadRequest.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Choose an MP4, MOV or WebM video.' };
  const { maxBytes, maxSeconds } = mediaConfig();
  if (parsed.data.sizeBytes > maxBytes) {
    return { status: 'error', message: 'That video is too large. Try a shorter clip.' };
  }
  if (parsed.data.durationSeconds !== null && parsed.data.durationSeconds > maxSeconds) {
    return { status: 'error', message: `Keep videos to ${String(maxSeconds)} seconds or less.` };
  }
  try {
    const result = await beginUpload(await sessionClient(), parsed.data.listingId);
    if (result.status === 'limited') return limited(result.retryAfter);
    await recordEvent(
      { name: 'upload_started' },
      { listingId: parsed.data.listingId, actor: userId },
    );
    return { status: 'ok', uploadUrl: result.uploadUrl };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'upload_start_failed',
        code: error instanceof Error ? error.message.slice(0, 80) : 'unknown',
      }),
    );
    return { status: 'error', message: 'We couldn’t start the upload. Try again.' };
  }
}

/** Upload outcome reported by the browser (events only; media state comes from webhooks). */
export async function reportUpload(input: unknown): Promise<void> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return;
  const parsed = UploadEventInput.safeParse(input);
  if (!parsed.success) return;
  const own = await loadOwnListing(await sessionClient(), parsed.data.listingId);
  if (own === null) return;
  const event: ServerEvent =
    parsed.data.name === 'upload_failed'
      ? { name: 'upload_failed', reason: parsed.data.reason }
      : { name: parsed.data.name };
  await recordEvent(event, { listingId: own.id, actor: userId });
}

/** Step 3 (and later edits): title, category, condition, price, attributes, description, ZIP. */
export async function saveDetails(input: unknown): Promise<{ status: 'saved' } | SellError> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return userId;
  const parsed = ListingDetailsInput.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Check the highlighted fields.',
      fields: fieldErrors(parsed.error),
    };
  }
  const details = parsed.data;
  const taxonomy = await getTaxonomy();
  const department = taxonomy.departments.find((d) =>
    d.subcategories.some((s) => s.slug === details.categorySlug),
  );
  if (department === undefined) {
    return {
      status: 'error',
      message: 'Check the highlighted fields.',
      fields: { categorySlug: 'Choose a category.' },
    };
  }
  const attributes = listingAttributesSchema(
    filtersFor(department, details.categorySlug),
  ).safeParse(details.attributes);
  if (!attributes.success) {
    return {
      status: 'error',
      message: 'Check the highlighted fields.',
      fields: Object.fromEntries(
        Object.entries(fieldErrors(attributes.error)).map(([k, v]) => [`attributes.${k}`, v]),
      ),
    };
  }
  const freeOnly = department.attributes.free_only === true;
  const priceCents = freeOnly ? 0 : details.priceDollars * 100;

  const supabase = await sessionClient();
  const before = await loadOwnListing(supabase, details.listingId);
  if (before === null) return { status: 'error', message: NOT_FOUND };
  const { error } = await supabase.rpc('listing_update_details', {
    p_id: details.listingId,
    p_title: details.title,
    p_category_slug: details.categorySlug,
    p_condition: details.condition,
    p_price_cents: priceCents,
    p_attributes: attributes.data,
    p_description: details.description,
    p_pickup_zip: details.pickupZip,
  });
  if (error !== null) {
    if (error.code === '23503') {
      return {
        status: 'error',
        message: 'Check the highlighted fields.',
        fields: { pickupZip: 'We don’t recognize that ZIP code.' },
      };
    }
    if (error.code === '23514')
      return { status: 'error', message: 'Sold listings can’t be edited.' };
    return { status: 'error', message: GENERIC_ERROR };
  }
  if (before.status !== 'draft' && before.priceCents !== null && before.priceCents !== priceCents) {
    await recordEvent(
      { name: 'listing_price_changed', direction: priceCents < before.priceCents ? 'down' : 'up' },
      { listingId: before.id, actor: userId },
    );
  }
  if (before.status !== 'draft') revalidatePath(`/l/${before.id}`);
  return { status: 'saved' };
}

export type PublishOutcome = 'published' | 'in_review' | 'scheduled' | 'not_ready';

/** Step 4. The prohibited-item check holds matches for review (visible to the owner and admins). */
export async function publishListing(
  input: unknown,
): Promise<{ status: 'ok'; outcome: PublishOutcome } | SellError> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return userId;
  const parsed = PublishInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: GENERIC_ERROR };
  const supabase = await sessionClient();
  const own = await loadOwnListing(supabase, parsed.data.listingId);
  if (own === null) return { status: 'error', message: NOT_FOUND };
  if (own.status !== 'draft') return { status: 'ok', outcome: 'published' };
  const needsReview = prohibitedMatches(own.title ?? '', own.description).length > 0;
  const published = await supabase.rpc('listing_publish', {
    p_id: own.id,
    p_needs_review: needsReview,
    p_when_ready: parsed.data.whenReady,
  });
  const { error } = published;
  const data: unknown = published.data;
  if (error !== null) {
    return {
      status: 'error',
      message: error.code === '23514' ? 'Add the missing details first.' : GENERIC_ERROR,
    };
  }
  const outcome = z.enum(['published', 'in_review', 'scheduled', 'not_ready']).parse(data);
  if (outcome !== 'not_ready' && own.categorySlug !== null && own.departmentSlug !== null) {
    await recordEvent(
      {
        name: 'listing_published',
        department: own.departmentSlug,
        category: own.categorySlug,
        free: own.priceCents === 0,
        outcome,
      },
      { listingId: own.id, actor: userId },
    );
  }
  revalidatePath('/');
  return { status: 'ok', outcome };
}

export interface DraftStatus {
  status: 'ok';
  listingStatus: 'draft' | 'available' | 'pending' | 'sold';
  reviewState: 'ok' | 'needs_review';
  media: MediaStatus | null;
}

/** Polled while the video processes. */
export async function draftStatus(input: unknown): Promise<DraftStatus | SellError> {
  const userId = await verifiedUserId();
  if (typeof userId !== 'string') return userId;
  const parsed = ListingIdInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: NOT_FOUND };
  const own = await loadOwnListing(await sessionClient(), parsed.data.listingId);
  if (own === null) return { status: 'error', message: NOT_FOUND };
  return {
    status: 'ok',
    listingStatus: own.status,
    reviewState: own.reviewState,
    media: own.media?.status ?? null,
  };
}
