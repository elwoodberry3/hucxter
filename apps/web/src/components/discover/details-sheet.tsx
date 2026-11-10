'use client';

import { CONDITION_LABELS, formatPrice } from '@hucxter/contracts';
import type { ListingCard } from '@hucxter/contracts';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { ListingDescription } from '@/components/listing/description';
import { MessagePlaceholder } from '@/components/listing/message-placeholder';
import { StatusBadge } from '@/components/listing/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { SheetSize } from '@/components/ui/bottom-sheet';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { ItemEntry } from './item-data';
import styles from './details-sheet.module.css';

/**
 * Details sheet (Brief 03 Milestone 3D) over the paused video. Peek: price or Free, status,
 * condition, pickup area, the seller (avatar, display name, @handle to the profile, "Phone
 * verified") and the disabled message action. Expanded adds the attributes and the description
 * (plain text). "View full listing" goes to /l/[id]; Back from there restores this sheet.
 */
export function DetailsSheet({
  card,
  entry,
  size,
  onSizeChange,
  onClose,
  onRetry,
  onNavigate,
}: {
  card: ListingCard;
  entry: ItemEntry | undefined;
  /** Size to open at (peek, or what it was when the viewer left for the listing page). */
  size: SheetSize;
  onSizeChange: (size: SheetSize) => void;
  onClose: () => void;
  onRetry: () => void;
  onNavigate: (href: string) => void;
}) {
  const data = entry?.status === 'ok' ? entry.data : null;
  const listing = data?.detail;
  const expanded = size === 'expanded';

  let body;
  if (entry === undefined || entry.status === 'loading') {
    body = (
      <div className={styles.loading} aria-busy="true">
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="block" />
        <span className="visually-hidden">Loading details</span>
      </div>
    );
  } else if (entry.status === 'gone') {
    body = <p className={styles.gone}>This item is no longer available</p>;
  } else if (entry.status === 'error' || listing === undefined) {
    body = (
      <ErrorState
        title="Couldn’t load the details"
        body="Check your connection and try again."
        onRetry={onRetry}
      />
    );
  } else {
    const handle = listing.seller.handle;
    body = (
      <div className={styles.body}>
        <p className={styles.price}>
          <span>{formatPrice(listing.price_cents)}</span>
          <StatusBadge status={listing.status} />
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>Condition</dt>
            <dd>{CONDITION_LABELS[listing.condition]}</dd>
          </div>
          <div>
            <dt>Pickup area</dt>
            <dd>
              {listing.area_label}, {listing.state}
              {listing.distance_bucket === null ? '' : ` · ${listing.distance_bucket} away`}
            </dd>
          </div>
        </dl>
        <div className={styles.seller}>
          <Avatar name={listing.seller.display_name} src={listing.seller.avatar_url} size="sm" />
          <div>
            {handle === null || handle === undefined ? (
              <p className={styles.sellerName}>{listing.seller.display_name}</p>
            ) : (
              <p className={styles.sellerName}>
                <Link href={`/u/${handle}`}>
                  {listing.seller.display_name}
                  <span className={styles.handle}>@{handle}</span>
                </Link>
              </p>
            )}
            {listing.seller.phone_verified ? (
              <p className={styles.verified}>
                <BadgeCheck size={16} aria-hidden="true" /> Phone verified
              </p>
            ) : null}
          </div>
        </div>
        {data?.own === true ? null : (
          <div className={styles.message}>
            <MessagePlaceholder />
          </div>
        )}
        {expanded ? (
          <>
            {data === null || data.rows.length <= 1 ? null : (
              <section aria-labelledby="discover-details-attributes">
                <h3 id="discover-details-attributes" className={styles.heading}>
                  Details
                </h3>
                <dl className={styles.attributes}>
                  {data.rows.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {listing.description === '' ? null : (
              <section aria-labelledby="discover-details-description">
                <h3 id="discover-details-description" className={styles.heading}>
                  Description
                </h3>
                <ListingDescription text={listing.description} />
              </section>
            )}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <BottomSheet
      open
      className={styles.sheet ?? ''}
      onClose={onClose}
      title={card.title}
      size={size}
      expandable
      onSizeChange={onSizeChange}
      onNavigate={(href) => {
        onNavigate(href);
      }}
      footer={
        <Link href={`/l/${card.id}`} className={styles.full}>
          View full listing
        </Link>
      }
    >
      {body}
    </BottomSheet>
  );
}
