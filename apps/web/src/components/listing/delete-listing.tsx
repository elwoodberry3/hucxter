'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { deleteListing } from '@/app/actions/listings';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { cx } from '@/lib/cx';
import styles from './template.module.css';

/** Delete with a specific confirmation (design system: destructive actions confirm). */
export function DeleteListingButton({
  listingId,
  draft = false,
  onError,
}: {
  listingId: string;
  draft?: boolean;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const title = draft ? 'Delete draft?' : 'Delete listing?';

  const remove = () => {
    startTransition(async () => {
      const result = await deleteListing({ listingId });
      setConfirming(false);
      // Success redirects to /listings?deleted=1 from the server.
      if (result.status === 'error') onError(result.message);
    });
  };

  return (
    <>
      <button
        type="button"
        className={cx(styles.secondary, styles.destructiveText)}
        disabled={pending}
        onClick={() => {
          setConfirming(true);
        }}
      >
        <Trash2 size={16} aria-hidden="true" /> Delete
      </button>
      <BottomSheet
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        title={title}
        size="peek"
        footer={
          <div className={styles.sheetActions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.destructive}
              disabled={pending}
              onClick={remove}
            >
              {pending ? 'Deleting…' : draft ? 'Delete draft' : 'Delete listing'}
            </button>
          </div>
        }
      >
        <p>
          {draft
            ? 'The draft and its video are deleted. This can’t be undone.'
            : 'Buyers won’t see it any more, and its video is deleted. This can’t be undone.'}
        </p>
      </BottomSheet>
    </>
  );
}
