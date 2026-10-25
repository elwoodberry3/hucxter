import type { ListingCard } from '@hucxter/contracts';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { CategoryArt } from '@/components/art/category-art';
import { ListingCardView } from '@/components/listing/listing-card';
import { cx } from '@/lib/cx';
import styles from './home.module.css';

export interface RailInvitation {
  /** "Be the first to list furniture near Celina" */
  title: string;
  body: string;
  sellLabel: string;
  browse: { label: string; href: string };
  heroKey: string;
}

/**
 * A "near you" rail. With listings it scrolls horizontally; without, it shows a designed
 * invitation card instead. It never shows placeholder listings.
 */
export function Rail({
  id,
  title,
  seeAll,
  listings,
  invitation,
  compact = false,
}: {
  compact?: boolean;
  id: string;
  title: string;
  seeAll: { label: string; href: string };
  listings: ListingCard[];
  invitation: RailInvitation;
}) {
  const headingId = `rail-${id}`;
  return (
    <section className={styles.rail} aria-labelledby={headingId}>
      <div className={styles.sectionHeader}>
        <h2 id={headingId} className={styles.sectionTitle}>
          {title}
        </h2>
        <Link href={seeAll.href} className={styles.seeAll}>
          {seeAll.label}
        </Link>
      </div>
      {listings.length > 0 ? (
        <ul className={styles.railList}>
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingCardView listing={listing} href={`/l/${listing.id}`} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={cx(styles.invitation, compact && styles.invitationCompact)}>
          <div className={styles.invitationArt}>
            <CategoryArt heroKey={invitation.heroKey} size="banner" />
          </div>
          <div className={styles.invitationCopy}>
            <h3 className={styles.invitationTitle}>{invitation.title}</h3>
            <p className={styles.invitationBody}>{invitation.body}</p>
            <div className={styles.buttonRow}>
              <Link href="/sell" className={styles.primaryButton}>
                <Plus size={16} aria-hidden="true" />
                {invitation.sellLabel}
              </Link>
              <Link href={invitation.browse.href} className={styles.secondaryButton}>
                {invitation.browse.label}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
