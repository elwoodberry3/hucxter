import type { ListingStatus } from '@hucxter/contracts';
import { cx } from '@/lib/cx';
import styles from './listing.module.css';

const LABELS: Record<ListingStatus, string> = {
  available: 'Available',
  pending: 'Pending: someone’s on the way',
  sold: 'Sold',
};

/** Listing status (ADR-0009): Available / Pending: someone's on the way / Sold. */
export function StatusBadge({ status }: { status: ListingStatus }) {
  return <span className={cx(styles.badge, styles[`badge_${status}`])}>{LABELS[status]}</span>;
}
