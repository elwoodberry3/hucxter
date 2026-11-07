'use client';

import { useId, useState, useTransition } from 'react';
import { deleteAccount } from '@/app/actions/account';
import { PhoneStep } from '@/components/onboarding/steps';
import { cx } from '@/lib/cx';
import styles from '@/components/auth/auth.module.css';

/** Settings → Phone: changing the number needs a new SMS code. */
export function PhoneChange({ captchaSiteKey }: { captchaSiteKey: string | null }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => {
          setOpen(true);
        }}
      >
        Change number
      </button>
    );
  }
  return <PhoneStep next={null} captchaSiteKey={captchaSiteKey} context="settings" />;
}

/** Settings → Delete account: typed confirmation, then everything is revoked and deleted. */
export function DeleteAccountForm() {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const errorId = useId();
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await deleteAccount({ confirm });
          if (result.status === 'error') setError(result.message);
        });
      }}
    >
      <label htmlFor={inputId} className={styles.label}>
        Type DELETE to confirm
      </label>
      <input
        id={inputId}
        className={styles.input}
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={confirm}
        aria-describedby={error === null ? undefined : errorId}
        onChange={(event) => {
          setConfirm(event.target.value);
        }}
      />
      <button
        type="submit"
        className={cx(styles.primary, styles.destructive)}
        disabled={pending || confirm !== 'DELETE'}
      >
        {pending ? 'Deleting…' : 'Delete my account'}
      </button>
      <p id={errorId} role="alert" className={styles.error}>
        {error}
      </p>
    </form>
  );
}
