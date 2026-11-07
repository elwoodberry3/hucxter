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

export type ReportTarget =
  { kind: 'listing'; listingId: string } | { kind: 'profile'; handle: string };

// Listing-only reasons (prohibited, counterfeit, stolen) don't fit a profile.
const PROFILE_REASONS: readonly ReportReason[] = [
  'scam',
  'harassment',
  'unsafe_meetup',
  'minor_safety',
  'other',
];

const COPY = {
  listing: {
    prompt: 'Sign in to report a listing',
    title: 'Report this listing',
    thanks: 'Thanks. Our team will review this listing.',
    anonymity: 'The seller won’t see who reported.',
  },
  profile: {
    prompt: 'Sign in to report a profile',
    title: 'Report this profile',
    thanks: 'Thanks. Our team will review this profile.',
    anonymity: 'They won’t see who reported.',
  },
} as const;

/**
 * Report: a reason + optional note sheet for verified members, for a listing or a profile.
 * Everyone else gets the gated button (guests: the sign-in sheet; unverified members: on to
 * /welcome). Profiles are sent by @handle, never by id.
 */
export function ReportButton({
  target,
  verified,
  className,
  label = 'Report',
  labelClassName,
}: {
  target: ReportTarget;
  verified: boolean;
  className?: string | undefined;
  label?: string;
  labelClassName?: string | undefined;
}) {
  const copy = COPY[target.kind];
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
      <GatedActionButton action="report" prompt={copy.prompt} className={className}>
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
      const result = await submitReport(
        target.kind === 'listing'
          ? { targetType: 'listing', targetId: target.listingId, reason, note }
          : { targetType: 'profile', handle: target.handle, reason, note },
      );
      if (result.status === 'sent') {
        setOpen(false);
        setReason(null);
        setNote('');
        toast(copy.thanks);
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
        title={copy.title}
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
          {(target.kind === 'listing' ? REPORT_REASONS : PROFILE_REASONS).map((value) => (
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
        <p className={styles.metaSmall}>{copy.anonymity} If someone is in danger, call 911.</p>
        <p role="alert" className={styles.ownerError}>
          {error}
        </p>
      </BottomSheet>
    </>
  );
}
