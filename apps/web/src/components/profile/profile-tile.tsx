import { CONDITION_LABELS, formatPrice } from '@hucxter/contracts';
import { Eye, Film, Pencil } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/listing/status-badge';
import cardStyles from '@/components/listing/listing.module.css';
import { DeleteDraft } from '@/components/listings/delete-draft';
import type { ProfileTile as Tile } from '@/server/profile/load';
import styles from './profile.module.css';

const STATE_LABELS = {
  draft: 'Draft',
  review: 'In review',
  removed: 'Removed',
} as const;

function tileHref(tile: Tile): string | null {
  if (tile.state === 'removed') return null;
  if (tile.state === 'draft') return `/sell?draft=${tile.id}&step=review`;
  return `/l/${tile.id}`;
}

/**
 * A 9:16 listing tile on a profile: poster, price, title, status badge. The owner also sees where
 * it stands (Draft, In review, Removed), its real view count, and the actions that fit.
 */
export function ProfileTileView({ tile, owner }: { tile: Tile; owner: boolean }) {
  const title = tile.title ?? 'Untitled draft';
  const href = tileHref(tile);
  const poster = (
    <span className={cardStyles.poster}>
      {tile.hasPoster ? (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin poster route
        <img src={`/media/poster/${tile.id}`} alt="" className={cardStyles.posterImage} />
      ) : (
        <span className={styles.noPoster}>
          <Film size={28} aria-hidden="true" />
        </span>
      )}
      {tile.state === 'live' ? (
        tile.status === 'available' ? null : (
          <span className={cardStyles.posterBadge}>
            <StatusBadge status={tile.status === 'draft' ? 'available' : tile.status} />
          </span>
        )
      ) : (
        <span className={cardStyles.posterBadge}>
          <span className={styles.stateBadge} data-state={tile.state}>
            {tile.processing ? 'Processing' : STATE_LABELS[tile.state]}
          </span>
        </span>
      )}
    </span>
  );
  const body = (
    <>
      {poster}
      <span className={cardStyles.cardPrice}>
        {tile.priceCents === null ? 'No price yet' : formatPrice(tile.priceCents)}
      </span>
      <span className={cardStyles.cardTitle}>{title}</span>
      {tile.condition === null ? null : (
        <span className={cardStyles.cardMeta}>{CONDITION_LABELS[tile.condition]}</span>
      )}
    </>
  );
  return (
    <article className={cardStyles.card}>
      {href === null ? (
        <div className={cardStyles.cardLink}>{body}</div>
      ) : (
        <Link href={href} className={cardStyles.cardLink}>
          {body}
        </Link>
      )}
      {owner ? (
        <div className={styles.tileOwner}>
          {tile.views === null || tile.state !== 'live' ? null : (
            <p className={styles.views}>
              <Eye size={14} aria-hidden="true" /> {tile.views.toLocaleString('en-US')}{' '}
              {tile.views === 1 ? 'view' : 'views'}
            </p>
          )}
          <div className={styles.tileActions}>
            {tile.state === 'draft' ? (
              <DeleteDraft listingId={tile.id} />
            ) : tile.state === 'live' && tile.status !== 'sold' ? (
              <Link
                href={`/listings/${tile.id}/edit`}
                className={styles.tileButton}
                aria-label={`Edit ${title}`}
              >
                <Pencil size={14} aria-hidden="true" /> Edit
              </Link>
            ) : tile.state === 'live' ? null : (
              <DeleteDraft listingId={tile.id} published />
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
