import type { ListingCard as ListingCardData } from '@hucxter/contracts';
import { CONDITION_LABELS, formatPrice } from '@hucxter/contracts';
import Link from 'next/link';
import { StatusBadge } from './status-badge';
import styles from './listing.module.css';

/** Listing card for grids and rails: 9:16 poster, price, title, condition, distance, area. */
export function ListingCardView({ listing, href }: { listing: ListingCardData; href: string }) {
  return (
    <article className={styles.card}>
      <Link href={href} className={styles.cardLink}>
        <span className={styles.poster}>
          {/* Plain <img>: same-origin posters only (CSP img-src 'self'); next/image adds inline styles. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={listing.poster_url} alt="" className={styles.posterImage} />
          {listing.is_demo ? <span className={styles.demoTag}>Demo</span> : null}
          {listing.status === 'pending' ? (
            <span className={styles.posterBadge}>
              <StatusBadge status="pending" />
            </span>
          ) : null}
        </span>
        <span className={styles.cardPrice}>{formatPrice(listing.price_cents)}</span>
        <span className={styles.cardTitle}>{listing.title}</span>
        <span className={styles.cardMeta}>
          {CONDITION_LABELS[listing.condition]} · {listing.distance_bucket} · {listing.area_label}
        </span>
      </Link>
    </article>
  );
}
