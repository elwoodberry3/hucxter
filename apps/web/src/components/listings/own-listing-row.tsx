import { formatPrice } from '@hucxter/contracts';
import { Film } from 'lucide-react';
import Link from 'next/link';
import { DeleteDraft } from './delete-draft';
import { OwnerControls } from '@/components/listing/owner-panel';
import { StatusBadge } from '@/components/listing/status-badge';
import { listedAgo } from '@/components/listing/listing-template';
import type { OwnListing, OwnTab } from '@/server/listings/owner';
import styles from './listings.module.css';

const MEDIA_NOTES = {
  awaiting_upload: 'No video yet',
  processing: 'Video processing',
  ready: 'Video ready',
  errored: 'Video didn’t work. Upload another.',
  removed: 'Video removed',
} as const;

function reviewNote(listing: OwnListing): string {
  return listing.removed
    ? 'Removed by Hucxter: it breaks our rules for what can be listed.'
    : 'We’re reviewing this listing. Only you can see it until it’s approved.';
}

/** One row of /listings: what it is, where it stands, and the actions that fit that state. */
export function OwnListingRow({ listing, tab }: { listing: OwnListing; tab: OwnTab }) {
  const title = listing.title ?? 'Untitled draft';
  // null while it's a draft; otherwise the buyer-facing status.
  const published = listing.status === 'draft' ? null : listing.status;
  const unpublished = published === null;
  const href = unpublished ? `/sell?draft=${listing.id}&step=review` : `/l/${listing.id}`;
  // Posters only for listings a buyer could see (the poster route checks the same thing).
  const showPoster = tab === 'live' || tab === 'sold';
  return (
    <li className={styles.row}>
      <span className={styles.thumb}>
        {showPoster ? (
          // eslint-disable-next-line @next/next/no-img-element -- same-origin poster route
          <img src={`/media/poster/${listing.id}`} alt="" className={styles.thumbImage} />
        ) : (
          <Film size={24} aria-hidden="true" />
        )}
      </span>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link href={href}>{title}</Link>
        </h3>
        <p className={styles.meta}>
          {listing.priceCents === null ? 'No price yet' : formatPrice(listing.priceCents)}
          {' · '}
          {unpublished
            ? `Edited ${listedAgo(listing.updatedAt)}`
            : `Listed ${listedAgo(listing.publishedAt ?? listing.createdAt)}`}
        </p>
        {unpublished ? (
          <p className={styles.note}>
            {listing.media === null
              ? MEDIA_NOTES.awaiting_upload
              : MEDIA_NOTES[listing.media.status]}
            {listing.publishWhenReady && tab === 'processing'
              ? ' · Publishes when the video is ready'
              : ''}
          </p>
        ) : tab === 'review' ? (
          <p className={styles.note} data-tone="warning">
            {reviewNote(listing)}
          </p>
        ) : (
          <StatusBadge status={published} />
        )}
      </div>
      <div className={styles.actions}>
        {unpublished ? (
          <>
            <Link href={href} className={styles.button}>
              Continue
            </Link>
            <DeleteDraft listingId={listing.id} />
          </>
        ) : tab === 'review' ? (
          <DeleteDraft listingId={listing.id} published />
        ) : (
          <OwnerControls listingId={listing.id} status={published} views={null} compact />
        )}
      </div>
    </li>
  );
}
