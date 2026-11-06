'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { approveHeldListing, dismissOpenReport, removeReportedListing } from '@/app/actions/admin';
import type { AdminResult } from '@/app/actions/admin';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/components/ui/toast';
import styles from './admin.module.css';

/** Approve / Remove (confirmed, optional note) / Dismiss for one queue item. */
export function ModerationActions({
  listingId,
  listingTitle,
  reportId,
  canApprove = false,
}: {
  listingId?: string | undefined;
  listingTitle?: string | undefined;
  reportId?: string | undefined;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const reasonId = useId();

  const run = (action: () => Promise<AdminResult>, done: string) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      setConfirming(false);
      toast(done);
      router.refresh();
    });
  };

  return (
    <div className={styles.actions}>
      {canApprove && listingId !== undefined ? (
        <button
          type="button"
          className={styles.button}
          disabled={pending}
          onClick={() => {
            run(() => approveHeldListing({ listingId }), 'Approved. It’s live again.');
          }}
        >
          Approve
        </button>
      ) : null}
      {listingId !== undefined ? (
        <button
          type="button"
          className={styles.destructiveText}
          disabled={pending}
          onClick={() => {
            setConfirming(true);
          }}
        >
          Remove listing
        </button>
      ) : null}
      {reportId !== undefined ? (
        <button
          type="button"
          className={styles.button}
          disabled={pending}
          onClick={() => {
            run(() => dismissOpenReport({ reportId }), 'Report dismissed.');
          }}
        >
          Dismiss report
        </button>
      ) : null}
      <p role="alert" className={styles.error}>
        {error}
      </p>
      {listingId === undefined ? null : (
        <BottomSheet
          open={confirming}
          onClose={() => {
            setConfirming(false);
          }}
          title="Remove listing?"
          size="peek"
          footer={
            <div className={styles.sheetActions}>
              <button
                type="button"
                className={styles.button}
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
                onClick={() => {
                  run(
                    () => removeReportedListing({ listingId, reason }),
                    'Removed. Its video can’t be played any more.',
                  );
                }}
              >
                {pending ? 'Removing…' : 'Remove listing'}
              </button>
            </div>
          }
        >
          <p>
            “{listingTitle ?? 'This listing'}” is hidden from everyone but its seller, its video
            stops playing, and open reports about it are closed.
          </p>
          <label htmlFor={reasonId} className={styles.label}>
            Note for the audit log (optional)
          </label>
          <textarea
            id={reasonId}
            className={styles.textarea}
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </BottomSheet>
      )}
    </div>
  );
}
