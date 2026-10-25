import type { FeedItem } from '@hucxter/contracts';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { CategoryArt } from '@/components/art/category-art';
import { ListingCardView } from '@/components/listing/listing-card';
import styles from './home.module.css';

/** Renders one feed envelope item. Unknown or not-yet-supported types render nothing. */
export function FeedItemView({ item }: { item: FeedItem }) {
  switch (item.type) {
    case 'listing':
      return <ListingCardView listing={item.listing} href={`/l/${item.listing.id}`} />;
    case 'sponsored':
      return (
        <aside className={styles.promoSlot} aria-label={item.disclosure}>
          <div className={styles.promoSlotArt}>
            <CategoryArt heroKey={item.sponsored.art_key} size="banner" />
          </div>
          <div className={styles.promoSlotCopy}>
            <p className={styles.disclosure}>
              {item.disclosure}
              <span className={styles.whyShown}>
                <Info size={14} aria-hidden="true" />
                {item.why_shown}
              </span>
            </p>
            <h2 className={styles.promoSlotTitle}>{item.sponsored.headline}</h2>
            <p className={styles.promoSlotBody}>{item.sponsored.body}</p>
            <Link href={item.sponsored.href} className={styles.secondaryButton}>
              {item.sponsored.cta_label}
            </Link>
          </div>
        </aside>
      );
    default:
      return null;
  }
}
