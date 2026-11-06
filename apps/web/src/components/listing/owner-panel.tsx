'use client';

import { Eye, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setListingStatus } from '@/app/actions/listings';
import { cx } from '@/lib/cx';
import { DeleteListingButton } from './delete-listing';
import styles from './template.module.css';

type Status = 'available' | 'pending' | 'sold';

/**
 * The owner's controls on their own listing (Brief 03C.1 §3.4): Edit, Mark pending / They didn't
 * show, Mark sold, Delete (confirmed), and the owner-only view count. Shared with /listings.
 */
export function OwnerControls({
  listingId,
  status,
  views,
  compact = false,
}: {
  listingId: string;
  status: Status;
  views: number | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (next: Status) => {
    setError(null);
    startTransition(async () => {
      const result = await setListingStatus({ listingId, status: next });
      if (result.status === 'error') setError(result.message);
      else router.refresh();
    });
  };

  return (
    <div className={cx(styles.ownerPanel, compact && styles.ownerCompact)}>
      {views === null ? null : (
        <p className={styles.ownerStat}>
          <Eye size={16} aria-hidden="true" /> {views.toLocaleString('en-US')}{' '}
          {views === 1 ? 'view' : 'views'}
          <span className={styles.ownerStatNote}> · only you can see this</span>
        </p>
      )}
      <div className={styles.ownerButtons}>
        {status === 'sold' ? null : (
          <Link href={`/listings/${listingId}/edit`} className={styles.secondary}>
            <Pencil size={16} aria-hidden="true" /> Edit
          </Link>
        )}
        {status === 'available' ? (
          <button
            type="button"
            className={styles.secondary}
            disabled={pending}
            onClick={() => {
              change('pending');
            }}
          >
            Mark pending
          </button>
        ) : null}
        {status === 'pending' ? (
          <button
            type="button"
            className={styles.secondary}
            disabled={pending}
            onClick={() => {
              change('available');
            }}
          >
            They didn’t show
          </button>
        ) : null}
        {status === 'sold' ? null : (
          <button
            type="button"
            className={styles.secondary}
            disabled={pending}
            onClick={() => {
              change('sold');
            }}
          >
            Mark sold
          </button>
        )}
        <DeleteListingButton listingId={listingId} onError={setError} />
      </div>
      <p role="alert" className={styles.ownerError}>
        {error}
      </p>
    </div>
  );
}
