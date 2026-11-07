'use client';

import { useState } from 'react';
import { DeleteListingButton } from '@/components/listing/delete-listing';
import styles from './listings.module.css';

/** Delete for drafts and in-review listings (no status controls apply to them). */
export function DeleteDraft({
  listingId,
  published = false,
}: {
  listingId: string;
  published?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <DeleteListingButton listingId={listingId} draft={!published} onError={setError} />
      <p role="alert" className={styles.error}>
        {error}
      </p>
    </>
  );
}
