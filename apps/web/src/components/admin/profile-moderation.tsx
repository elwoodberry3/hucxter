'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { moderateReportedProfile } from '@/app/actions/admin';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/components/ui/toast';
import styles from './admin.module.css';

type Action = 'dismiss' | 'remove_photo' | 'clear_bio' | 'require_new_name';

const COPY: Record<
  Action,
  {
    button: string;
    title: string;
    body: string;
    confirm: string;
    done: string;
    destructive: boolean;
  }
> = {
  dismiss: {
    button: 'Dismiss report',
    title: 'Dismiss report?',
    body: 'The profile stays as it is and the report is closed.',
    confirm: 'Dismiss report',
    done: 'Report dismissed.',
    destructive: false,
  },
  remove_photo: {
    button: 'Remove photo',
    title: 'Remove photo?',
    body: 'The photo file is deleted. Their initials show instead.',
    confirm: 'Remove photo',
    done: 'Photo removed.',
    destructive: true,
  },
  clear_bio: {
    button: 'Clear bio',
    title: 'Clear bio?',
    body: 'Their bio is emptied. They can write a new one.',
    confirm: 'Clear bio',
    done: 'Bio cleared.',
    destructive: true,
  },
  require_new_name: {
    button: 'Require new name & handle',
    title: 'Require a new name and handle?',
    body: 'Their name becomes “Hucxter member” and their handle a generated one. They must choose new ones before they can do anything else. The current handle is held for 30 days so nobody else can take it.',
    confirm: 'Require new name & handle',
    done: 'Name and handle reset.',
    destructive: true,
  },
};

/**
 * Staff actions for one reported profile (Brief 03C.2). Each opens a sheet that needs a reason for
 * the audit log. Remove photo and Clear bio appear only when there is something to remove.
 */
export function ProfileModeration({
  reportId,
  displayName,
  hasPhoto,
  hasBio,
  resetPending,
}: {
  reportId: string;
  displayName: string;
  hasPhoto: boolean;
  hasBio: boolean;
  resetPending: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const errorId = useId();

  const actions: Action[] = [
    'dismiss',
    ...(hasPhoto ? (['remove_photo'] as const) : []),
    ...(hasBio ? (['clear_bio'] as const) : []),
    ...(resetPending ? [] : (['require_new_name'] as const)),
  ];
  const copy = active === null ? null : COPY[active];
  const close = () => {
    setActive(null);
    setReason('');
    setError(null);
  };

  return (
    <div className={styles.actions}>
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          className={COPY[action].destructive ? styles.destructiveText : styles.button}
          disabled={pending}
          onClick={() => {
            setError(null);
            setActive(action);
          }}
        >
          {COPY[action].button}
        </button>
      ))}
      <BottomSheet
        open={active !== null}
        onClose={close}
        title={copy?.title ?? ''}
        size="peek"
        footer={
          <div className={styles.sheetActions}>
            <button type="button" className={styles.button} onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className={copy?.destructive === false ? styles.confirm : styles.destructive}
              disabled={pending || reason.trim() === ''}
              onClick={() => {
                if (active === null || copy === null) return;
                const done = copy.done;
                setError(null);
                startTransition(async () => {
                  const result = await moderateReportedProfile({
                    reportId,
                    action: active,
                    reason,
                  });
                  if (result.status === 'error') {
                    setError(result.message);
                    return;
                  }
                  close();
                  toast(done);
                  router.refresh();
                });
              }}
            >
              {pending ? 'Saving…' : copy?.confirm}
            </button>
          </div>
        }
      >
        <p>
          <strong>{displayName}</strong>. {copy?.body}
        </p>
        <label htmlFor={reasonId} className={styles.label}>
          Reason for the audit log (required)
        </label>
        <textarea
          id={reasonId}
          className={styles.textarea}
          maxLength={500}
          rows={3}
          required
          aria-describedby={error === null ? undefined : errorId}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      </BottomSheet>
    </div>
  );
}
