import 'server-only';
import { ReportReason } from '@hucxter/contracts';
import { z } from 'zod';
import { adminDb } from '@/server/admin-db';
import { prohibitedMatches } from '@/server/listings/prohibited';
import { posterUrl } from '@/server/media/playback';

/**
 * Minimal moderation queue (Brief 03C.1 §3.6): open reports and listings held for review. Read
 * with the service role because staff need rows RLS hides from members (reports about other
 * people's listings, listings in review). Callers must have passed requireStaff(); every write
 * also re-checks staff in SQL (assert_staff) and writes audit_log there. Reporters are never shown.
 */
const QUEUE_LIMIT = 50;

const ReportRow = z.object({
  id: z.uuid(),
  reason: ReportReason,
  note: z.string().nullable(),
  created_at: z.string(),
  target_type: z.enum(['listing', 'profile']),
  target_id: z.uuid(),
});

const ListingRow = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  description: z.string(),
  price_cents: z.number().int().nullable(),
  status: z.enum(['draft', 'available', 'pending', 'sold']),
  review_state: z.enum(['ok', 'needs_review']),
  removed_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  published_at: z.string().nullable(),
  seller_id: z.uuid(),
});

export interface QueueReport {
  id: string;
  reason: ReportReason;
  note: string | null;
  createdAt: string;
  targetType: 'listing' | 'profile';
  targetId: string;
  /** The reported listing, when it still exists. */
  listing: { title: string; status: string; removed: boolean; inReview: boolean } | null;
}

export interface QueueListing {
  id: string;
  title: string;
  description: string;
  priceCents: number | null;
  publishedAt: string | null;
  sellerName: string;
  /** Prohibited-item matches that held it (empty when held for another reason). */
  matches: string[];
  poster: string | null;
}

async function listingsById(ids: string[]) {
  if (ids.length === 0) return new Map<string, z.infer<typeof ListingRow>>();
  const { data, error } = await adminDb()
    .from('listings')
    .select(
      'id, title, description, price_cents, status, review_state, removed_at, deleted_at, published_at, seller_id',
    )
    .in('id', ids);
  if (error !== null) throw new Error(`admin_listings:${error.code}`);
  return new Map(
    z
      .array(ListingRow)
      .parse(data)
      .map((row) => [row.id, row]),
  );
}

/** Open reports, oldest first (a queue). */
export async function loadOpenReports(): Promise<QueueReport[]> {
  const { data, error } = await adminDb()
    .from('reports')
    .select('id, reason, note, created_at, target_type, target_id')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(QUEUE_LIMIT);
  if (error !== null) throw new Error(`admin_reports:${error.code}`);
  const rows = z.array(ReportRow).parse(data);
  const listings = await listingsById(
    rows.filter((r) => r.target_type === 'listing').map((r) => r.target_id),
  );
  return rows.map((row) => {
    const listing = row.target_type === 'listing' ? listings.get(row.target_id) : undefined;
    return {
      id: row.id,
      reason: row.reason,
      note: row.note,
      createdAt: row.created_at,
      targetType: row.target_type,
      targetId: row.target_id,
      listing:
        listing === undefined || listing.deleted_at !== null
          ? null
          : {
              title: listing.title ?? 'Untitled',
              status: listing.status,
              removed: listing.removed_at !== null,
              inReview: listing.review_state === 'needs_review',
            },
    };
  });
}

/** A poster for the queue; a provider failure just means no thumbnail. */
async function safePoster(mediaId: string): Promise<string | null> {
  try {
    return await posterUrl(mediaId, 240);
  } catch {
    return null;
  }
}

/** Published (or scheduled) listings held for review, oldest first. */
export async function loadReviewListings(): Promise<QueueListing[]> {
  const db = adminDb();
  const { data, error } = await db
    .from('listings')
    .select(
      'id, title, description, price_cents, status, review_state, removed_at, deleted_at, published_at, seller_id',
    )
    .eq('review_state', 'needs_review')
    .is('removed_at', null)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(QUEUE_LIMIT);
  if (error !== null) throw new Error(`admin_review:${error.code}`);
  const rows = z.array(ListingRow).parse(data);
  const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
  const names = new Map<string, string>();
  const media = new Map<string, string>();
  if (rows.length > 0) {
    const [profiles, mediaRows] = await Promise.all([
      db.from('profiles').select('id, display_name').in('id', sellerIds),
      db
        .from('listing_media')
        .select('id, listing_id')
        .in(
          'listing_id',
          rows.map((r) => r.id),
        ),
    ]);
    for (const p of z
      .array(z.object({ id: z.uuid(), display_name: z.string().nullable() }))
      .parse(profiles.data ?? [])) {
      names.set(p.id, p.display_name ?? 'Hucxter member');
    }
    for (const m of z
      .array(z.object({ id: z.uuid(), listing_id: z.uuid() }))
      .parse(mediaRows.data ?? [])) {
      media.set(m.listing_id, m.id);
    }
  }
  return Promise.all(
    rows.map(async (row) => {
      const mediaId = media.get(row.id);
      const poster = mediaId === undefined ? null : await safePoster(mediaId);
      return {
        id: row.id,
        title: row.title ?? 'Untitled',
        description: row.description,
        priceCents: row.price_cents,
        publishedAt: row.published_at,
        sellerName: names.get(row.seller_id) ?? 'Hucxter member',
        matches: prohibitedMatches(row.title ?? '', row.description),
        poster,
      };
    }),
  );
}

export type ModerationResult = 'ok' | 'gone' | 'forbidden' | 'failed';

function outcome(error: { code: string } | null): ModerationResult {
  if (error === null) return 'ok';
  if (error.code === 'P0002') return 'gone'; // no_data_found: already handled by someone else
  if (error.code === '42501') return 'forbidden';
  return 'failed';
}

export async function approveListing(actorId: string, listingId: string) {
  const { error } = await adminDb().rpc('admin_listing_approve', {
    p_actor: actorId,
    p_listing_id: listingId,
  });
  return outcome(error);
}

export async function removeListing(actorId: string, listingId: string, reason: string) {
  const { error } = await adminDb().rpc('admin_listing_remove', {
    p_actor: actorId,
    p_listing_id: listingId,
    p_reason: reason,
  });
  return outcome(error);
}

export async function dismissReport(actorId: string, reportId: string) {
  const { error } = await adminDb().rpc('admin_report_dismiss', {
    p_actor: actorId,
    p_report_id: reportId,
  });
  return outcome(error);
}
