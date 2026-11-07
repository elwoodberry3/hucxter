'use client';

import { REPORT_REASONS, REPORT_REASON_LABELS } from '@hucxter/contracts';
import type { ReportReason } from '@hucxter/contracts';
import { Flag } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { submitReport } from '@/app/actions/report';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/components/ui/toast';
import { GatedActionButton } from './gated-action';
import styles from './template.module.css';

/**
 * Report: a reason + optional note sheet for verified members. Everyone else gets the gated
 * button (guests: the sign-in sheet; unverified members: on to /welcome).
 */
export function ReportButton({
  listingId,
  verified,
  className,
  label = 'Report',
  labelClassName,
}: {
  listingId: string;
  verified: boolean;
  className?: string | undefined;
  label?: string;
  labelClassName?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const noteId = useId();
  const content = (
    <>
      <Flag size={18} aria-hidden="true" />
      <span className={labelClassName}>{label}</span>
    </>
  );
  if (!verified) {
    return (
      <GatedActionButton action="report" prompt="Sign in to report a listing" className={className}>
        {content}
      </GatedActionButton>
    );
  }
  const send = () => {
    if (reason === null) {
      setError('Choose a reason.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReport({
        targetType: 'listing',
        targetId: listingId,
        reason,
        note,
      });
      if (result.status === 'sent') {
        setOpen(false);
        setReason(null);
        setNote('');
        toast('Thanks. Our team will review this listing.');
      } else {
        setError(result.message);
      }
    });
  };
  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        {content}
      </button>
      <BottomSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Report this listing"
        footer={
          <div className={styles.sheetActions}>
            <button type="button" className={styles.primarySheet} disabled={pending} onClick={send}>
              {pending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        }
      >
        <fieldset className={styles.reasons}>
          <legend className={styles.panelTitle}>What’s wrong?</legend>
          {REPORT_REASONS.map((value) => (
            <label key={value} className={styles.reason}>
              <input
                type="radio"
                name="report-reason"
                value={value}
                checked={reason === value}
                onChange={() => {
                  setReason(value);
                }}
              />
              {REPORT_REASON_LABELS[value]}
            </label>
          ))}
        </fieldset>
        <label htmlFor={noteId} className={styles.panelTitle}>
          Anything else? <span className={styles.metaSmall}>(optional)</span>
        </label>
        <textarea
          id={noteId}
          className={styles.note}
          rows={3}
          maxLength={500}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
        <p className={styles.metaSmall}>
          The seller won’t see who reported. If someone is in danger, call 911.
        </p>
        <p role="alert" className={styles.ownerError}>
          {error}
        </p>
      </BottomSheet>
    </>
  );
}
